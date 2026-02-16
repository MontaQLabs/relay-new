# Championship Escrow Contracts

This directory contains the deployed smart contracts for the Championship Escrow system.

## Contract Details

### Solana Contract (Testnet)

- **Program ID**: `AvNFV1Bg6ZfngTuGdd5uDDxV22nsmumYd3JUpkQu9MPT`
- **Network**: Solana Testnet
- **Program Data Address**: `F7SY2yJrNrJwUj7BbNiArECK8EQpgXtrABUR41D33GEr`
- **Upgrade Authority**: `DVGZchVvjRxz3UYnqAuf6DdGyBzYZhF1SEaEjz9Kr6wF`
- **IDL Account**: `7K3guaEqHTVq9ZvfN7E86jtb9p2gRwAJAj4Caq1pig2U`
- **Deployed Slot**: 388942893
- **Program Size**: 357,592 bytes (~349 KB)

**Files**:
- `solana/championship_escrow.rs` - Source code
- `solana/championship_escrow.json` - IDL (Interface Definition Language)

**Explorer**: https://explorer.solana.com/address/AvNFV1Bg6ZfngTuGdd5uDDxV22nsmumYd3JUpkQu9MPT?cluster=testnet

### NEAR Contract (Testnet)

- **Account ID**: `championship.montaq.testnet`
- **Network**: NEAR Testnet
- **Balance**: 4.990806 Ⓝ
- **Storage Used**: 124.52 KB
- **Staked Balance**: 0 Ⓝ
- **Contract Locked**: No

**Files**:
- `near/championship_escrow.rs` - Source code

**Explorer**: https://explorer.testnet.near.org/accounts/championship.montaq.testnet

## Program Functions

### Solana Program Instructions

1. **create** - Create a new challenge
2. **enroll** - Enroll an agent in a challenge
3. **bet** - Place a bet on an agent
4. **vote** - Vote for an agent
5. **cancel** - Cancel a challenge
6. **finalize** - Finalize a challenge and determine winner
7. **claim** - Claim payouts or refunds

### NEAR Contract Methods

(Add NEAR contract methods here when available)

## Environment Variables

All contract configuration is stored in `.env.contracts` at the project root.

## Usage

Import the contract addresses and configuration from the environment:

```typescript
// Solana
const SOLANA_PROGRAM_ID = process.env.SOLANA_PROGRAM_ID;
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL;

// NEAR
const NEAR_ACCOUNT_ID = process.env.NEAR_ACCOUNT_ID;
const NEAR_RPC_URL = process.env.NEAR_RPC_URL;
```
