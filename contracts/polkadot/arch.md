# Poker Arena Contract — Final Design

**Single contract. One dealer (VPS). Anyone creates tables. Bots join and play. Humans bet. Platform earns fees.**

---

## Roles

| Role              | Who                | Set Where                                        |
| ----------------- | ------------------ | ------------------------------------------------ |
| **Platform**      | Deployer address   | At deploy, stored globally                       |
| **Global Dealer** | VPS script address | At deploy = platform, updatable by platform only |
| **Table Creator** | Anyone             | Calls `createTable()` + sends prize pool         |
| **Agent (Bot)**   | Anyone             | Calls `joinTable()` + sends buy-in               |
| **Human Bettor**  | Anyone             | Calls `placeBet()` + sends DOT before deadline   |

---

## Money Flows

- **Prize Pool**: locked by table creator at `createTable()` (msg.value). Never touched during play. Released at session end.
- **Buy-in**: locked by each agent at `joinTable()` (msg.value). Becomes their chip stack. Circulates via pot during play.
- **Human Bets**: locked by bettors at `placeBet()` (msg.value). Held in escrow. Paid out at session end.

---

## Contract State

### Global

- `platform_address` — fee recipient, can update dealer
- `dealer_address` — VPS script that manages all table flow
- `table_count` — next table ID

### Per-Table

- Creator, prize pool amount, buy-in amount, max_agents (2-8), session_length (N hands)
- Bet deadline (unix timestamp) — human bet window
- State: `Open | Playing | Ended | Cancelled`
- Current hand number, pot, current_turn seat, current_bet, betting_round
- Active agent count (not folded/kicked)
- Total human bet pool
- Last action timestamp (for cancel guard)
- Prize claimed flag (to avoid double platform fee payment)

### Per-Agent (per seat)

- Address, chip count, folded flag, kicked flag, missed_turns counter
- Current hand bet amount
- Chips claimed flag

### Per-Bettor (by index)

- Address, agent seat backed, amount bet, claimed flag

### Per-Agent Bet Total (table + seat)

- Total DOT bet on that agent across all bettors

---

## Unified Flow

1. **`createTable(buy_in, max_agents, session_length, bet_deadline)`** + send prize_pool as msg.value
   - Creates table, sets state = Open, locks prize pool

2. **`joinTable(tableId)`** + send exact buy_in
   - Agent registered to a seat, buy-in becomes chip stack
   - Max 8 agents, min 2 to deal
   - Duplicate join rejected

3. **`placeBet(tableId, agentSeat)`** + send DOT
   - Accepted only while state = Open AND now < bet_deadline
   - Multiple bets from same address: all tracked, all refunded/settled

4. **`deal(tableId, deckHash)`** — dealer only
   - Requires >= 2 active agents
   - On first deal: state transitions Open → Playing, closes betting window
   - Resets per-hand state (unfold all, zero hand bets, reset pot)
   - Sets current_turn to first active seat
   - Resets `last_action_timestamp`

5. **`action(tableId, action, amount)`** — agent OR dealer
   - Actions: 0=fold, 1=check, 2=call, 3=raise
   - If caller is dealer → it's a timeout fold → increments missed_turns
   - If missed_turns >= 3 → agent kicked, remaining chips forfeited to prize pool
   - Rejects if agent tries to bet more chips than they have
   - Auto-win: if only 1 agent left after fold → that agent wins pot immediately
   - Resets `last_action_timestamp`

6. **`resolveHand(tableId, winningSeat)`** — dealer only
   - Awards pot to winner seat
   - Resets `last_action_timestamp`
   - Checks session end condition after pot award

7. **Session End Conditions** (checked after every hand)
   - current_hand >= session_length → end normally
   - active agents (not kicked) <= 1 → end early

8. **`endSession(tableId)`** — dealer only (manual override)
   - Forces state to Ended (or Cancelled if still Open)

---

## Cancel Guard

**`cancel(tableId)`** — permissionless, but strictly guarded:

Succeeds ONLY IF:

- `(A)` State = Open AND now > bet_deadline AND current_hand == 0
  → dealer never showed up to deal
- `(B)` State = Playing AND now - last_action_timestamp > 3600 seconds
  → dealer went dark mid-game for >1 hour

During an active game (dealer submitting actions regularly), last_action_timestamp is recent → cancel always reverts → no griefing possible.

---

## Payout Logic

### Chip Settlement (after session ends)

- Each agent calls `claimChips(tableId)` to withdraw their remaining chip count
- No platform fee — this is their own money returned from gameplay

### Prize Pool Distribution

- Agent(s) with highest chip count = winner(s)
- **Platform gets 5% of prize pool** (sent to platform_address on first claim)
- **Winner(s) split 95% of prize pool** proportionally if tied
- Any agent who was kicked has 0 chips → cannot win prize
- Winners call `claimPrize(tableId)` to collect

### Human Betting Payout

- Find agent with most chips (same winner as prize)
- **Platform gets 5% of total bet pool**
- **Bettors who backed the winning agent split 95%** proportionally by bet size
- If no one bet on the winner: entire bet pool sent to platform (edge case)
- Bettors call `claimBetWinnings(tableId)` to collect

### Refunds (Cancelled state only)

- Agents: full buy-in back
- Creator: full prize pool back
- Bettors: full bet amount back
- Kicked agents: no refund (already forfeited mid-game)
- Anyone calls `refund(tableId)` for their own funds

---

## Edge Cases

| Scenario                  | Resolution                                              |
| ------------------------- | ------------------------------------------------------- |
| All fold except one       | Last agent auto-wins pot, next hand starts              |
| Agent misses 3 turns      | Kicked, chips forfeit to prize pool, session continues  |
| All agents kicked         | Session ends immediately, chip snapshot at kick time    |
| Only 1 agent remaining    | Session ends, that agent wins prize                     |
| Chip tie for prize        | Prize pool split proportionally among tied agents       |
| Agent bets > chips        | Contract rejects action                                 |
| Human bets after deadline | Contract rejects                                        |
| Dealer goes dark > 1hr    | Anyone can `cancel()`, full refunds issued              |
| Table never filled        | After bet_deadline, anyone can `cancel()`               |
| Creator cancels           | Only via `endSession()` if they are the platform/dealer |

---

## Fee Summary

| Fee          | Rate | On What           | Paid To          |
| ------------ | ---- | ----------------- | ---------------- |
| Platform cut | 5%   | Prize pool        | platform_address |
| Platform cut | 5%   | Human bet pool    | platform_address |
| Chips        | 0%   | Agent chip claims | n/a              |

---

## Why This Works

- **One escrow**: all money (prize pool + buy-ins + bets) in one contract
- **Global dealer**: VPS manages all tables, no trust required per table
- **Cancel guard**: time-gated, not permission-gated — can't be weaponized
- **Kick + forfeit**: incentivizes bots to stay online; crashed bots fund the prize for survivors
- **Atomic settlement**: all payouts computed from on-chain chip snapshots, no oracle needed
