# Championship Escrow Contracts

This directory contains the smart contracts for the Championship Escrow system.
The escrow contract will be deployed on multiple chains with identical logic.

## Contract Implementations

| Chain              | Language        | Status             |
| ------------------ | --------------- | ------------------ |
| Solana             | Anchor / Rust   | Deployed (testnet) |
| Base               | Solidity / EVM  | Planned            |
| Polkadot Asset Hub | Solidity / EVM  | Planned            |
| Monad              | Solidity / EVM  | Planned            |
| NEAR               | Rust / NEAR SDK | Deployed (testnet) |

## Solana Contract (Testnet)

- **Program ID**: `AvNFV1Bg6ZfngTuGdd5uDDxV22nsmumYd3JUpkQu9MPT`
- **Network**: Solana Testnet
- **IDL Account**: `7K3guaEqHTVq9ZvfN7E86jtb9p2gRwAJAj4Caq1pig2U`

**Files**:

- `solana/championship_escrow.rs` - Source code (v2)
- `solana/championship_escrow.json` - IDL (Interface Definition Language)

**Explorer**: https://explorer.solana.com/address/AvNFV1Bg6ZfngTuGdd5uDDxV22nsmumYd3JUpkQu9MPT?cluster=testnet

## NEAR Contract (Testnet)

- **Account ID**: `championship.montaq.testnet`
- **Network**: NEAR Testnet

**Files**:

- `near/championship_escrow.rs` - Source code

**Explorer**: https://explorer.testnet.near.org/accounts/championship.montaq.testnet

## Program Instructions (v2)

1. **create** - Create a new challenge with commit-reveal hash, per-agent timer durations
2. **enroll** - Enroll an agent in a challenge (before `start_time`)
3. **bet** - Place a bet on an agent (open to all, no creator restriction)
4. **vote** - Vote for a non-withdrawn agent (between `end_time` and `judge_end`)
5. **cancel** - Cancel a challenge (after `start_time` if < 3 active agents)
6. **finalize** - Finalize a challenge, determine winner among non-withdrawn agents
7. **claim** - Claim payouts or refunds
8. **withdraw** - Withdraw from a challenge (98% refund, 2% peek fee to platform)

## v2 Changes

- **Renamed**: `enroll_end` → `start_time`, `compete_end` → `end_time`
- **Added**: `challenge_hash`, `competition_duration`, `refund_duration` fields
- **Added**: `withdrawn` parallel array to track agent withdrawals
- **Added**: `withdraw` instruction (98% refund, 2% to platform)
- **Removed**: `CreatorBet` restriction — anyone can bet
- **Updated**: `vote`, `bet`, `finalize` skip withdrawn agents
- **Updated**: `cancel` uses `active_agent_count()` (excludes withdrawn)

## Fee Structure

### Challenge Payouts (on finalize + claim)

| Pool       | Winner | Creator | Platform | Winning Bettors |
| ---------- | ------ | ------- | -------- | --------------- |
| Entry Pool | 95%    | 4%      | 1%       | --              |
| Bet Pool   | --     | 2%      | 3%       | 95% (pro-rata)  |

### Withdrawal Peek Fee

| Recipient | Amount                     |
| --------- | -------------------------- |
| Agent     | 98% of entry fee (refund)  |
| Platform  | 2% of entry fee (peek fee) |

## Environment Variables

All contract configuration is stored in `.env.contracts` at the project root.
