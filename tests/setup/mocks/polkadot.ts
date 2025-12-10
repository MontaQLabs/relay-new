/**
 * Polkadot API mocks for testing
 */

import { vi } from 'vitest';

// Mock valid test addresses
export const TEST_WALLET_ADDRESS = '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5';
export const TEST_WALLET_ADDRESS_2 = '14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3';
export const TEST_INVALID_ADDRESS = 'invalid_address';

// Mock mnemonic (12 words)
export const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Mock keypair
export const mockKeypair = {
  address: TEST_WALLET_ADDRESS,
  publicKey: new Uint8Array(32).fill(1),
  sign: vi.fn((message: Uint8Array) => new Uint8Array(64).fill(2)),
};

// Mock Keyring
export const mockKeyring = {
  addFromMnemonic: vi.fn(() => mockKeypair),
  addFromUri: vi.fn(() => mockKeypair),
  getPairs: vi.fn(() => [mockKeypair]),
};

// Mock crypto utilities
export const mockCryptoWaitReady = vi.fn().mockResolvedValue(true);

export const mockMnemonicGenerate = vi.fn(() => TEST_MNEMONIC);

export const mockMnemonicValidate = vi.fn((mnemonic: string) => {
  // Simple validation: 12 words separated by spaces
  const words = mnemonic.trim().split(/\s+/);
  return words.length === 12 || words.length === 24;
});

export const mockSignatureVerify = vi.fn((message: string, signature: Uint8Array, address: string) => {
  // For testing, return valid if address matches test address
  return {
    isValid: address === TEST_WALLET_ADDRESS || address === TEST_WALLET_ADDRESS_2,
    crypto: 'sr25519',
  };
});

export const mockDecodeAddress = vi.fn((address: string) => {
  if (address === TEST_INVALID_ADDRESS) {
    throw new Error('Invalid address');
  }
  return new Uint8Array(32).fill(0);
});

export const mockEncodeAddress = vi.fn(() => TEST_WALLET_ADDRESS);

// Mock Polkadot API client
export const createMockPolkadotClient = () => {
  return {
    getTypedApi: vi.fn(() => ({
      query: {
        System: {
          Account: {
            getValue: vi.fn().mockResolvedValue({
              data: {
                free: BigInt(10_000_000_000), // 1 DOT
                reserved: BigInt(0),
                frozen: BigInt(0),
              },
            }),
          },
        },
        Assets: {
          Account: {
            getValue: vi.fn().mockResolvedValue({
              balance: BigInt(1_000_000), // 1 USDT (6 decimals)
            }),
          },
          Asset: {
            getValue: vi.fn().mockResolvedValue({
              owner: TEST_WALLET_ADDRESS,
              issuer: TEST_WALLET_ADDRESS,
              admin: TEST_WALLET_ADDRESS,
              freezer: TEST_WALLET_ADDRESS,
              supply: BigInt(1_000_000_000_000),
              min_balance: BigInt(1000),
              accounts: 1000,
              status: { type: 'Live' },
              is_sufficient: true,
            }),
          },
          Metadata: {
            getValue: vi.fn().mockResolvedValue({
              name: { asBytes: () => new TextEncoder().encode('Tether USD') },
              symbol: { asBytes: () => new TextEncoder().encode('USDT') },
              decimals: 6,
            }),
          },
        },
      },
      tx: {
        Balances: {
          transfer_keep_alive: vi.fn(() => ({
            getEstimatedFees: vi.fn().mockResolvedValue(BigInt(1_000_000)), // 0.0001 DOT
            signAndSubmit: vi.fn().mockResolvedValue({
              txHash: '0x1234567890abcdef',
              block: { hash: '0xabcdef1234567890' },
            }),
          })),
        },
        Assets: {
          transfer_keep_alive: vi.fn(() => ({
            getEstimatedFees: vi.fn().mockResolvedValue(BigInt(1_000_000)),
            signAndSubmit: vi.fn().mockResolvedValue({
              txHash: '0x1234567890abcdef',
              block: { hash: '0xabcdef1234567890' },
            }),
          })),
        },
      },
    })),
    destroy: vi.fn(),
  };
};

// Mock WebSocket provider
export const mockGetWsProvider = vi.fn(() => ({}));

// Mock createClient
export const mockCreateClient = vi.fn(() => createMockPolkadotClient());

