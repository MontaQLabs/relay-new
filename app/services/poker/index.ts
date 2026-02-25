/**
 * Poker Arena — frontend service layer
 *
 * All contract reads go through this service (server or client).
 * All writes produce an encodedCalldata that the frontend signs via
 * the user's relay wallet mnemonic using the existing EVM adapter pattern.
 */

import {
    createWalletClient,
    http,
    encodeFunctionData,
    parseEther,
    formatEther,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import {
    pokerArenaClient,
    POKER_ARENA_ADDRESS,
    POKER_ARENA_ABI,
    paseoAssetHub,
    TABLE_STATE_LABEL,
    type TableState,
} from "./contract";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TableInfo {
    tableId: number;
    creator: string;
    prizePool: bigint;
    buyIn: bigint;
    maxAgents: number;
    agentCount: number;
    sessionLength: number;
    currentHand: number;
    betDeadline: bigint;
    state: TableState;
    stateLabel: string;
    prizePoolEth: string;
    buyInEth: string;
}

export interface AgentInfo {
    seat: number;
    agent: string;
    chips: bigint;
    chipsEth: string;
    folded: boolean;
    kicked: boolean;
    missedTurns: number;
}

export interface BetInfo {
    agentSeat: number;
    amount: bigint;
    amountEth: string;
    claimed: boolean;
}

export interface CreateTableParams {
    buyInEth: string;   // e.g. "0.01"
    prizePoolEth: string;   // e.g. "0.1"  — sent as msg.value
    maxAgents: number;
    sessionLength: number;
    betDeadlineSec: number;  // unix timestamp
}

// ---------------------------------------------------------------------------
// READS (can be called server-side or client-side)
// ---------------------------------------------------------------------------

export async function getTableInfo(tableId: number): Promise<TableInfo | null> {
    try {
        const result = await pokerArenaClient.readContract({
            address: POKER_ARENA_ADDRESS,
            abi: POKER_ARENA_ABI,
            functionName: "getTableInfo",
            args: [tableId],
        });

        const [creator, prizePool, buyIn, maxAgents, agentCount,
            sessionLength, currentHand, betDeadline, state] = result as [
                string, bigint, bigint, number, number,
                number, number, bigint, number
            ];

        return {
            tableId,
            creator,
            prizePool,
            buyIn,
            maxAgents,
            agentCount,
            sessionLength,
            currentHand,
            betDeadline,
            state: state as TableState,
            stateLabel: TABLE_STATE_LABEL[state as TableState],
            prizePoolEth: formatEther(prizePool),
            buyInEth: formatEther(buyIn),
        };
    } catch {
        return null;
    }
}

export async function getAgentInfo(tableId: number, seat: number): Promise<AgentInfo | null> {
    try {
        const result = await pokerArenaClient.readContract({
            address: POKER_ARENA_ADDRESS,
            abi: POKER_ARENA_ABI,
            functionName: "getAgentInfo",
            args: [tableId, seat],
        });

        const [agent, chips, folded, kicked, missedTurns] = result as
            [string, bigint, boolean, boolean, number];

        return { seat, agent, chips, chipsEth: formatEther(chips), folded, kicked, missedTurns };
    } catch {
        return null;
    }
}

export async function getBetInfo(tableId: number, bettorAddress: string): Promise<BetInfo | null> {
    try {
        const result = await pokerArenaClient.readContract({
            address: POKER_ARENA_ADDRESS,
            abi: POKER_ARENA_ABI,
            functionName: "getBetInfo",
            args: [tableId, bettorAddress as `0x${string}`],
        });

        const [agentSeat, amount, claimed] = result as [number, bigint, boolean];
        if (amount === 0n) return null;
        return { agentSeat, amount, amountEth: formatEther(amount), claimed };
    } catch {
        return null;
    }
}

export async function getTotalBetPool(tableId: number): Promise<bigint> {
    try {
        const result = await pokerArenaClient.readContract({
            address: POKER_ARENA_ADDRESS,
            abi: POKER_ARENA_ABI,
            functionName: "getTotalBetPool",
            args: [tableId],
        });
        return result as bigint;
    } catch {
        return 0n;
    }
}

export async function getCurrentPot(tableId: number): Promise<bigint> {
    try {
        const result = await pokerArenaClient.readContract({
            address: POKER_ARENA_ADDRESS,
            abi: POKER_ARENA_ABI,
            functionName: "getCurrentPot",
            args: [tableId],
        });
        return result as bigint;
    } catch {
        return 0n;
    }
}

export async function getAgentBetTotal(tableId: number, seat: number): Promise<bigint> {
    try {
        const result = await pokerArenaClient.readContract({
            address: POKER_ARENA_ADDRESS,
            abi: POKER_ARENA_ABI,
            functionName: "getAgentBetTotal",
            args: [tableId, seat],
        });
        return result as bigint;
    } catch {
        return 0n;
    }
}

// ---------------------------------------------------------------------------
// WRITES — signed with the relay wallet mnemonic (same pattern as EVM adapter)
// ---------------------------------------------------------------------------

function makeWalletClient(mnemonic: string) {
    const account = mnemonicToAccount(mnemonic);
    return {
        client: createWalletClient({
            account,
            chain: paseoAssetHub,
            transport: http(),
        }),
        account,
    };
}

export async function createTable(mnemonic: string, params: CreateTableParams) {
    const { client, account } = makeWalletClient(mnemonic);
    const buyIn = parseEther(params.buyInEth);
    const prizePool = parseEther(params.prizePoolEth);
    const maxAgents = params.maxAgents;
    const sessionLen = params.sessionLength;
    const betDeadline = BigInt(params.betDeadlineSec);

    const hash = await client.writeContract({
        address: POKER_ARENA_ADDRESS,
        abi: POKER_ARENA_ABI,
        functionName: "createTable",
        args: [buyIn, maxAgents, sessionLen, betDeadline],
        value: prizePool,
        account,
    });

    const receipt = await pokerArenaClient.waitForTransactionReceipt({ hash });

    // Extract tableId from TableCreated event log
    let tableId: number | undefined;
    for (const log of receipt.logs) {
        try {
            // topic[0] = event sig, topic[1] = indexed tableId
            if (log.topics[1]) {
                tableId = Number(BigInt(log.topics[1]));
            }
        } catch { /**/ }
    }

    return { hash, receipt, tableId };
}

export async function joinTable(mnemonic: string, tableId: number, buyInWei: bigint) {
    const { client, account } = makeWalletClient(mnemonic);
    const hash = await client.writeContract({
        address: POKER_ARENA_ADDRESS,
        abi: POKER_ARENA_ABI,
        functionName: "joinTable",
        args: [tableId],
        value: buyInWei,
        account,
    });
    const receipt = await pokerArenaClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
}

export async function placeBet(
    mnemonic: string,
    tableId: number,
    agentSeat: number,
    amountWei: bigint
) {
    const { client, account } = makeWalletClient(mnemonic);
    const hash = await client.writeContract({
        address: POKER_ARENA_ADDRESS,
        abi: POKER_ARENA_ABI,
        functionName: "placeBet",
        args: [tableId, agentSeat],
        value: amountWei,
        account,
    });
    const receipt = await pokerArenaClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
}

export async function claimChips(mnemonic: string, tableId: number) {
    const { client, account } = makeWalletClient(mnemonic);
    const hash = await client.writeContract({
        address: POKER_ARENA_ADDRESS,
        abi: POKER_ARENA_ABI,
        functionName: "claimChips",
        args: [tableId],
        account,
    });
    const receipt = await pokerArenaClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
}

export async function claimPrize(mnemonic: string, tableId: number) {
    const { client, account } = makeWalletClient(mnemonic);
    const hash = await client.writeContract({
        address: POKER_ARENA_ADDRESS,
        abi: POKER_ARENA_ABI,
        functionName: "claimPrize",
        args: [tableId],
        account,
    });
    const receipt = await pokerArenaClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
}

export async function claimBetWinnings(mnemonic: string, tableId: number) {
    const { client, account } = makeWalletClient(mnemonic);
    const hash = await client.writeContract({
        address: POKER_ARENA_ADDRESS,
        abi: POKER_ARENA_ABI,
        functionName: "claimBetWinnings",
        args: [tableId],
        account,
    });
    const receipt = await pokerArenaClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
}

export async function refund(mnemonic: string, tableId: number) {
    const { client, account } = makeWalletClient(mnemonic);
    const hash = await client.writeContract({
        address: POKER_ARENA_ADDRESS,
        abi: POKER_ARENA_ABI,
        functionName: "refund",
        args: [tableId],
        account,
    });
    const receipt = await pokerArenaClient.waitForTransactionReceipt({ hash });
    return { hash, receipt };
}
