/**
 * Poker Arena — VPS Dealer Script (relay-new integrated)
 *
 * This script:
 *  1. Watches Supabase `challenges` table for poker challenges (chain_id = "westend-asset-hub")
 *     that are in `competing` status — those have a `tableId` in metadata and need a dealer.
 *  2. Manages the on-chain PokerArena contract for each table:
 *     - Deals hands
 *     - Times out agents and auto-folds
 *     - Evaluates hands and resolves them on-chain
 *  3. Writes results back to Supabase:
 *     - Updates `challenges.status` → completed
 *     - Sets `challenges.winner_agent_id`
 *     - Inserts payout records into `challenge_payouts` (pending, for relay-new to execute)
 *  4. Runs an Express health/admin API on PORT (default 3339)
 *
 * Run:  node dealer.js
 * PM2:  pm2 start dealer.js --name poker-dealer
 */

"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "key.env") });

const { ethers } = require("ethers");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { makeDeck, findWinners } = require("./poker.js");

// ============================================================================
// CONFIG
// ============================================================================
const {
    PRIVATE_KEY,
    CONTRACT_ADDRESS,
    RPC_URL,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    AGENT_TIMEOUT_SECS = "30",
    PORT = "3339",
} = process.env;

if (!PRIVATE_KEY || !CONTRACT_ADDRESS || !RPC_URL) {
    console.error("❌ Missing PRIVATE_KEY, CONTRACT_ADDRESS, or RPC_URL in key.env");
    process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in key.env");
    process.exit(1);
}

const AGENT_TIMEOUT_MS = Number(AGENT_TIMEOUT_SECS) * 1000;
const POLL_INTERVAL_MS = 10_000; // how often to check Supabase for new tables
const CHAIN_ID = "westend-asset-hub"; // matches relay-new chain_id for poker challenges

// ============================================================================
// SUPABASE CLIENT
// ============================================================================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============================================================================
// CONTRACT ABI
// ============================================================================
const ABI = [
    "function deal(uint32 tableId, bytes32 deckHash) external",
    "function action(uint32 tableId, uint8 action, uint256 amount) external",
    "function resolveHand(uint32 tableId, uint8 winningSeat) external",
    "function endSession(uint32 tableId) external",
    "function getTableInfo(uint32 tableId) external view returns (address creator, uint256 prizePool, uint256 buyIn, uint8 maxAgents, uint8 agentCount, uint32 sessionLength, uint32 currentHand, uint64 betDeadline, uint8 state)",
    "function getAgentInfo(uint32 tableId, uint8 seat) external view returns (address agent, uint256 chips, bool folded, bool kicked, uint8 missedTurns)",
    "event TableCreated(uint32 indexed tableId)",
    "event SessionEnded(uint32 indexed tableId)",
    "event HandResolved(uint32 indexed tableId, uint32 handNumber, uint8 winningSeat)",
    "event AgentKicked(uint32 indexed tableId, uint8 seat, address agent)",
];

// ============================================================================
// PROVIDER + WALLET
// ============================================================================
let provider, wallet, contract;

function setup() {
    provider = RPC_URL.startsWith("wss") || RPC_URL.startsWith("ws")
        ? new ethers.WebSocketProvider(RPC_URL)
        : new ethers.JsonRpcProvider(RPC_URL);

    wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    console.log(`✅ Dealer wallet: ${wallet.address}`);
    console.log(`✅ Contract:      ${CONTRACT_ADDRESS}`);

    if (provider._websocket) {
        provider._websocket.on("close", () => {
            console.warn("⚠️  WS dropped. Reconnecting in 5s...");
            setTimeout(() => { setup(); subscribeToEvents(); }, 5000);
        });
    }
}

// ============================================================================
// IN-MEMORY GAME STATE
// tables: Map<tableId, GameState>
// ============================================================================
const tables = new Map();

const STATE = { OPEN: 0, PLAYING: 1, ENDED: 2, CANCELLED: 3 };

function log(tid, ...args) { console.log(`[T${tid}]`, ...args); }

async function sendTx(method, ...args) {
    const tx = await method(...args);
    return tx.wait();
}

// ============================================================================
// SUPABASE HELPERS
// ============================================================================

/**
 * Fetch all challenges on westend-asset-hub in `competing` status
 * that have a `tableId` stored in their metadata JSON column.
 * We store tableId in `challenges.metadata` as { tableId: number }.
 */
async function fetchActivePokeerChallenges() {
    const { data, error } = await supabase
        .from("challenges")
        .select("challenge_id, status, metadata, escrow_address, winner_agent_id")
        .eq("chain_id", CHAIN_ID)
        .in("status", ["competing"])
        .not("metadata->tableId", "is", null);

    if (error) {
        console.error("Supabase fetch error:", error.message);
        return [];
    }
    return data || [];
}

/**
 * Get challenge_agents for a challenge, ordered by enrolled_at.
 * Each seat maps to one agent (in join order).
 */
async function fetchChallengeAgents(challengeId) {
    const { data, error } = await supabase
        .from("challenge_agents")
        .select("id, challenge_id, owner_wallet, agent_name, endpoint_url")
        .eq("challenge_id", challengeId)
        .eq("entry_verified", true)
        .order("enrolled_at", { ascending: true });

    if (error) {
        console.error("fetch agents error:", error.message);
        return [];
    }
    return data || [];
}

/**
 * Mark challenge as completed, set winner, trigger payout insertion.
 */
async function finalizeChallenge(challengeId, winnerAgentId, agentSeats, tableId) {
    // 1. Set winner and status
    const { error: updateErr } = await supabase
        .from("challenges")
        .update({
            status: "completed",
            winner_agent_id: winnerAgentId,
        })
        .eq("challenge_id", challengeId);

    if (updateErr) {
        console.error("Failed to finalize challenge in Supabase:", updateErr.message);
        return;
    }

    console.log(`✅ Challenge ${challengeId} finalized. Winner agent: ${winnerAgentId}`);

    // 2. Insert pending payout records — the relay-new treasury service will execute them
    // The actual DOT amounts come from the on-chain contract state.
    await insertPayoutRecords(challengeId, winnerAgentId, tableId);
}

/**
 * Insert payout records in challenge_payouts — relay-new treasury service picks these up.
 * Amounts are read from chain state.
 */
async function insertPayoutRecords(challengeId, winnerAgentId, tableId) {
    let info;
    try {
        info = await contract.getTableInfo(tableId);
    } catch (_) { return; }

    const prizePool = info.prizePool; // BigInt (planck)
    const platformFee = prizePool * 500n / 10_000n;  // 5%
    const winnerPrize = prizePool - platformFee;

    // Fetch platform wallet from env or Supabase config
    const platformWallet = process.env.PLATFORM_WALLET_ADDRESS || "";

    // Fetch winner wallet
    const { data: agentRow } = await supabase
        .from("challenge_agents")
        .select("owner_wallet")
        .eq("id", winnerAgentId)
        .single();

    if (!agentRow) return;

    const payouts = [
        {
            challenge_id: challengeId,
            recipient_wallet: agentRow.owner_wallet,
            amount_dot: winnerPrize.toString(),
            payout_type: "entry_prize",
            status: "pending",
        },
        {
            challenge_id: challengeId,
            recipient_wallet: platformWallet,
            amount_dot: platformFee.toString(),
            payout_type: "platform_entry_fee",
            status: "pending",
        },
    ];

    // Insert betting payouts
    const { data: bets } = await supabase
        .from("challenge_bets")
        .select("bettor_wallet, amount_dot, agent_id")
        .eq("challenge_id", challengeId)
        .eq("agent_id", winnerAgentId)
        .eq("verified", true);

    if (bets && bets.length > 0) {
        const { data: challenge } = await supabase
            .from("challenges")
            .select("total_bet_pool_dot")
            .eq("challenge_id", challengeId)
            .single();

        const totalBetPool = BigInt(challenge?.total_bet_pool_dot || "0");
        const betPlatFee = totalBetPool * 500n / 10_000n;
        const betWinPool = totalBetPool - betPlatFee;

        const totalBetOnWinner = bets.reduce((s, b) => s + BigInt(b.amount_dot), 0n);

        for (const bet of bets) {
            const share = totalBetOnWinner > 0n
                ? betWinPool * BigInt(bet.amount_dot) / totalBetOnWinner
                : 0n;
            if (share > 0n) {
                payouts.push({
                    challenge_id: challengeId,
                    recipient_wallet: bet.bettor_wallet,
                    amount_dot: share.toString(),
                    payout_type: "bet_winnings",
                    status: "pending",
                });
            }
        }

        payouts.push({
            challenge_id: challengeId,
            recipient_wallet: platformWallet,
            amount_dot: betPlatFee.toString(),
            payout_type: "platform_bet_fee",
            status: "pending",
        });
    }

    const { error } = await supabase.from("challenge_payouts").insert(payouts);
    if (error) console.error("Failed to insert payout records:", error.message);
    else console.log(`💸 Inserted ${payouts.length} payout records for ${challengeId}`);
}

// ============================================================================
// GAME MANAGEMENT — same logic as original dealer.js, extended with DB calls
// ============================================================================

async function startTable(tableId, challengeId, agents) {
    if (tables.has(tableId)) return;

    let info;
    try { info = await contract.getTableInfo(tableId); }
    catch (e) { console.error(`T${tableId} getTableInfo failed:`, e.message); return; }

    const agentCount = Number(info.agentCount);
    const sessionLength = Number(info.sessionLength);

    // Map DB agents to seats (in join order)
    // agents[i] → seat i
    const game = {
        tableId,
        challengeId,
        agentCount,
        sessionLength,
        currentHand: 0,
        state: STATE.PLAYING,
        deck: null,
        holeCards: {},    // seat → [card, card]
        community: [],
        currentTurn: 0,
        activeSeats: new Set([...Array(agentCount).keys()]),
        turnTimer: null,
        waitingForAction: false,
        bettingRound: 0,     // 0=preflop 1=flop 2=turn 3=river
        actedThisRound: new Set(),
        agents,                // DB agent rows in seat order
        _deckIdx: 0,
    };

    tables.set(tableId, game);
    log(tableId, `Starting — ${agentCount} agents, ${sessionLength} hands (challenge: ${challengeId})`);
    await dealHand(tableId);
}

async function dealHand(tableId) {
    const game = tables.get(tableId);
    if (!game) return;

    // Refresh active seats (re-check kicked status from chain)
    game.activeSeats = new Set();
    for (let s = 0; s < game.agentCount; s++) {
        try {
            const ai = await contract.getAgentInfo(tableId, s);
            if (!ai.kicked) game.activeSeats.add(s);
        } catch (_) { }
    }

    if (game.activeSeats.size < 2) {
        log(tableId, "< 2 active agents. Ending session.");
        try { await sendTx(contract.endSession.bind(contract), tableId); } catch (_) { }
        await settleSession(tableId);
        return;
    }

    game.deck = makeDeck();
    game.holeCards = {};
    game.community = [];
    game.bettingRound = 0;
    game.actedThisRound = new Set();

    let cardIdx = 0;
    for (const seat of game.activeSeats) {
        game.holeCards[seat] = [game.deck[cardIdx++], game.deck[cardIdx++]];
        log(tableId, `Seat ${seat} (${game.agents[seat]?.agent_name}) hole cards: ${game.holeCards[seat].join(", ")}`);

        // Optionally notify the bot via its endpoint_url (fire-and-forget)
        const endpoint = game.agents[seat]?.endpoint_url;
        if (endpoint) {
            notifyAgent(endpoint, {
                type: "hole_cards",
                tableId,
                seat,
                cards: game.holeCards[seat],
            }).catch(() => { }); // don't block on network failures
        }
    }

    game._deckIdx = cardIdx;

    const commitment = ethers.id(game.deck.join(","));
    log(tableId, `Hand ${game.currentHand + 1} — deck commitment: ${commitment.slice(0, 18)}...`);

    try {
        await sendTx(contract.deal.bind(contract), tableId, commitment);
        game.currentHand++;
        game.currentTurn = firstActive(game);
        game.waitingForAction = true;
        startTurnTimer(tableId);
    } catch (err) {
        log(tableId, "deal() failed:", err.message);
    }
}

/**
 * Notify a bot agent of game state via its registered HTTP endpoint.
 * Agents respond via the on-chain `action()` call — this is just informational.
 */
async function notifyAgent(endpointUrl, payload) {
    const { default: https } = await import("https");
    const { default: http } = await import("http");
    const url = new URL(endpointUrl);
    const body = JSON.stringify(payload);
    const opts = {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const mod = url.protocol === "https:" ? https : http;
    return new Promise((res, rej) => {
        const req = mod.request(opts, r => res(r.statusCode));
        req.on("error", rej);
        req.setTimeout(3000, () => { req.destroy(); rej(new Error("timeout")); });
        req.write(body); req.end();
    });
}

async function advanceBettingRound(tableId) {
    const game = tables.get(tableId);
    if (!game) return;

    game.actedThisRound = new Set();
    game.bettingRound++;

    if (game.bettingRound === 1) {          // FLOP
        game._deckIdx++;
        game.community = [
            game.deck[game._deckIdx++],
            game.deck[game._deckIdx++],
            game.deck[game._deckIdx++],
        ];
        log(tableId, `🂡 FLOP: ${game.community.join(", ")}`);
    } else if (game.bettingRound === 2) {   // TURN
        game._deckIdx++;
        game.community.push(game.deck[game._deckIdx++]);
        log(tableId, `🂡 TURN: ${game.community.at(-1)}`);
    } else if (game.bettingRound === 3) {   // RIVER
        game._deckIdx++;
        game.community.push(game.deck[game._deckIdx++]);
        log(tableId, `🂡 RIVER: ${game.community.at(-1)}`);
    } else {
        await resolveShowdown(tableId);
        return;
    }

    // Notify all active agents of new community cards
    for (const seat of game.activeSeats) {
        const endpoint = game.agents[seat]?.endpoint_url;
        if (endpoint) {
            notifyAgent(endpoint, { type: "community_cards", tableId, cards: game.community }).catch(() => { });
        }
    }

    game.currentTurn = firstActive(game);
    game.waitingForAction = true;
    startTurnTimer(tableId);
}

async function resolveShowdown(tableId) {
    const game = tables.get(tableId);
    if (!game) return;

    const handArray = Array.from({ length: game.agentCount }, (_, s) =>
        game.activeSeats.has(s) ? [...(game.holeCards[s] || []), ...game.community] : null
    );

    const winners = findWinners(handArray);
    const winningSeat = winners[0];
    log(tableId, `🏆 Showdown. Winner seat ${winningSeat}`);

    try {
        await sendTx(contract.resolveHand.bind(contract), tableId, winningSeat);
    } catch (err) {
        log(tableId, "resolveHand() failed:", err.message);
        return;
    }

    let info;
    try { info = await contract.getTableInfo(tableId); } catch (_) { return; }

    if (Number(info.state) === STATE.ENDED) {
        await settleSession(tableId);
        return;
    }

    await delay(2000);
    await dealHand(tableId);
}

/** Session over — find chip leader on-chain, finalize in Supabase */
async function settleSession(tableId) {
    const game = tables.get(tableId);
    if (!game) return;

    log(tableId, "Session ended. Settling...");

    let maxChips = 0n;
    let winningSeat = 0;
    for (let s = 0; s < game.agentCount; s++) {
        try {
            const ai = await contract.getAgentInfo(tableId, s);
            if (ai.chips > maxChips) { maxChips = ai.chips; winningSeat = s; }
        } catch (_) { }
    }

    const winnerAgentRow = game.agents[winningSeat];
    if (winnerAgentRow) {
        log(tableId, `Winner: seat ${winningSeat} = ${winnerAgentRow.agent_name}`);
        await finalizeChallenge(game.challengeId, winnerAgentRow.id, game.agents, tableId);
    }

    clearTurnTimer(game);
    tables.delete(tableId);
}

// ---- Turn management -------------------------------------------------------

function onActionReceived(tableId) {
    const game = tables.get(tableId);
    if (!game) return;
    clearTurnTimer(game);
    game.actedThisRound.add(game.currentTurn);
    game.waitingForAction = false;

    if (game.actedThisRound.size >= game.activeSeats.size) {
        advanceBettingRound(tableId).catch(console.error);
    } else {
        game.currentTurn = nextActive(game);
        game.waitingForAction = true;
        startTurnTimer(tableId);
    }
}

function startTurnTimer(tableId) {
    const game = tables.get(tableId);
    if (!game) return;
    clearTurnTimer(game);
    game.turnTimer = setTimeout(async () => {
        if (!game.waitingForAction) return;
        log(tableId, `⏰ Seat ${game.currentTurn} timed out. Auto-fold.`);
        try {
            await sendTx(contract.action.bind(contract), tableId, 0, 0n);
            onActionReceived(tableId);
        } catch (err) {
            log(tableId, "Auto-fold failed:", err.message);
        }
    }, AGENT_TIMEOUT_MS);
}

function clearTurnTimer(game) {
    if (game.turnTimer) { clearTimeout(game.turnTimer); game.turnTimer = null; }
}

function firstActive(game) { return [...game.activeSeats][0]; }
function nextActive(game) {
    const seats = [...game.activeSeats];
    return seats[(seats.indexOf(game.currentTurn) + 1) % seats.length];
}

// ============================================================================
// SUPABASE POLLING — discover new poker tables
// ============================================================================

const knownChallenges = new Set(); // challenge_ids we're already managing

async function pollSupabase() {
    const challenges = await fetchActivePokeerChallenges();
    for (const ch of challenges) {
        if (knownChallenges.has(ch.challenge_id)) continue;

        const tableId = ch.metadata?.tableId;
        if (tableId === undefined || tableId === null) continue;

        knownChallenges.add(ch.challenge_id);
        log(tableId, `Discovered challenge ${ch.challenge_id} in Supabase`);

        const agents = await fetchChallengeAgents(ch.challenge_id);
        if (agents.length < 2) {
            log(tableId, "Not enough verified agents yet, skipping.");
            knownChallenges.delete(ch.challenge_id);
            continue;
        }

        startTable(Number(tableId), ch.challenge_id, agents).catch(err => {
            console.error(`Failed to start table ${tableId}:`, err.message);
            knownChallenges.delete(ch.challenge_id);
        });
    }
}

// ============================================================================
// CONTRACT EVENT SUBSCRIPTIONS
// ============================================================================
function subscribeToEvents() {
    console.log("📡 Subscribing to contract events...");

    contract.on("SessionEnded", async (tableId) => {
        const tid = Number(tableId);
        log(tid, "SessionEnded event.");
        const game = tables.get(tid);
        if (game) {
            clearTurnTimer(game);
            await settleSession(tid).catch(console.error);
        }
    });

    contract.on("AgentKicked", (tableId, seat) => {
        const game = tables.get(Number(tableId));
        if (game) game.activeSeats.delete(Number(seat));
    });
}

// ============================================================================
// EXPRESS REST API
// ============================================================================
function startServer() {
    const app = express();
    app.use(express.json());

    app.get("/health", (req, res) => res.json({
        ok: true,
        dealer: wallet.address,
        contract: CONTRACT_ADDRESS,
        activeTables: [...tables.keys()],
        trackedChallenges: [...knownChallenges],
        uptime: Math.floor(process.uptime()),
    }));

    app.get("/table/:id", async (req, res) => {
        const tid = Number(req.params.id);
        try {
            const info = await contract.getTableInfo(tid);
            const game = tables.get(tid);
            res.json({
                state: Number(info.state),
                agentCount: Number(info.agentCount),
                currentHand: Number(info.currentHand),
                sessionLength: Number(info.sessionLength),
                prizePool: ethers.formatEther(info.prizePool),
                managedLocally: !!game,
                currentTurn: game?.currentTurn,
                bettingRound: game?.bettingRound,
                community: game?.community,
                challengeId: game?.challengeId,
            });
        } catch (e) { res.status(404).json({ error: "Table not found or RPC error" }); }
    });

    // Manually trigger an action on a specific table (admin use)
    app.post("/table/:id/fold-current", async (req, res) => {
        const tid = Number(req.params.id);
        try {
            const tx = await contract.action(tid, 0, 0n);
            await tx.wait();
            onActionReceived(tid);
            res.json({ ok: true, tx: tx.hash });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.post("/table/:id/end", async (req, res) => {
        const tid = Number(req.params.id);
        try {
            const tx = await contract.endSession(tid);
            await tx.wait();
            res.json({ ok: true, tx: tx.hash });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    app.listen(Number(PORT), () => {
        console.log(`🚀 Dealer API: http://0.0.0.0:${PORT}`);
        console.log(`   GET  /health`);
        console.log(`   GET  /table/:id`);
        console.log(`   POST /table/:id/fold-current`);
        console.log(`   POST /table/:id/end`);
    });
}

// ============================================================================
// UTILS
// ============================================================================
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
process.on("SIGTERM", () => { console.log("SIGTERM. Shutting down."); process.exit(0); });
process.on("SIGINT", () => { console.log("SIGINT. Shutting down."); process.exit(0); });

// ============================================================================
// MAIN
// ============================================================================
(async function main() {
    console.log("=======================================================");
    console.log("  🃏 POKER ARENA — VPS Dealer (relay-new integrated)  ");
    console.log("=======================================================");
    setup();
    startServer();
    subscribeToEvents();

    // Initial poll
    await pollSupabase();

    // Keep polling for new challenges
    setInterval(() => pollSupabase().catch(console.error), POLL_INTERVAL_MS);

    console.log(`✅ Dealer live. Polling Supabase every ${POLL_INTERVAL_MS / 1000}s for new poker tables.`);
})();
