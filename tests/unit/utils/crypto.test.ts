/**
 * Unit tests for app/utils/crypto.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TEST_WALLET_ADDRESS,
  testWallet,
  testCoins,
  testKnownAssets,
  testTransactions,
} from '../../setup/fixtures';

// Store original fetch
const originalFetch = global.fetch;

// Mock WebSocket provider
vi.mock('polkadot-api/ws-provider', () => ({
  getWsProvider: vi.fn(() => ({})),
}));

// Mock polkadot-api
vi.mock('polkadot-api', () => ({
  createClient: vi.fn(() => ({
    getTypedApi: vi.fn(() => ({
      query: {
        System: {
          Account: {
            getValue: vi.fn().mockResolvedValue({
              data: {
                free: BigInt(10_000_000_000), // 1 DOT
              },
            }),
          },
        },
        Assets: {
          Account: {
            getValue: vi.fn().mockResolvedValue({
              balance: BigInt(1_000_000), // 1 USDT
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
            getEstimatedFees: vi.fn().mockResolvedValue(BigInt(1_000_000)),
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
  })),
}));

// Mock descriptors
vi.mock('@polkadot-api/descriptors', () => ({
  pah: {},
}));

// Mock signer
vi.mock('@polkadot-api/signer', () => ({
  getPolkadotSigner: vi.fn(() => ({})),
}));

// Mock Keyring
vi.mock('@polkadot/keyring', () => ({
  Keyring: vi.fn().mockImplementation(() => ({
    addFromMnemonic: vi.fn(() => ({
      address: TEST_WALLET_ADDRESS,
      publicKey: new Uint8Array(32).fill(1),
      sign: vi.fn(() => new Uint8Array(64).fill(2)),
    })),
  })),
}));

vi.mock('@polkadot/util-crypto', () => ({
  cryptoWaitReady: vi.fn().mockResolvedValue(true),
}));

// Import after mocking
import {
  fetchTokenPrices,
  getTokenPrice,
  calculatePortfolioValue,
  filterTransactionsByMonth,
  calculateTransactionTotals,
} from '@/app/utils/crypto';

import { WALLET_KEY } from '@/app/types/constants';

describe('Crypto Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(WALLET_KEY, JSON.stringify(testWallet));
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchTokenPrices', () => {
    it('should return empty object for empty ticker array', async () => {
      const prices = await fetchTokenPrices([]);
      expect(prices).toEqual({});
    });

    it('should fetch prices from CoinGecko API', async () => {
      const mockResponse = {
        polkadot: { usd: 7.5, usd_24h_change: 2.5 },
        tether: { usd: 1.0, usd_24h_change: 0 },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const prices = await fetchTokenPrices(['DOT', 'USDt']);

      expect(prices).toHaveProperty('DOT');
      expect(prices.DOT.usd).toBe(7.5);
      expect(prices.DOT.usd_24h_change).toBe(2.5);
    });

    it('should return stablecoin defaults on API failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Service Unavailable',
      } as Response);

      const prices = await fetchTokenPrices(['USDt', 'USDC']);

      expect(prices.USDt).toEqual({ usd: 1, usd_24h_change: 0 });
      expect(prices.USDC).toEqual({ usd: 1, usd_24h_change: 0 });
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const prices = await fetchTokenPrices(['DOT', 'USDt']);

      // Should return stablecoin defaults
      expect(prices.USDt).toEqual({ usd: 1, usd_24h_change: 0 });
    });

    it('should default stablecoins to $1', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}), // Empty response
      } as Response);

      const prices = await fetchTokenPrices(['USDt', 'USDC', 'DAI']);

      expect(prices.USDt).toEqual({ usd: 1, usd_24h_change: 0 });
      expect(prices.USDC).toEqual({ usd: 1, usd_24h_change: 0 });
    });

    it('should handle unknown tickers', async () => {
      const mockResponse = {};

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const prices = await fetchTokenPrices(['UNKNOWN_TOKEN']);

      // Unknown non-stablecoin tokens shouldn't be in the result
      expect(prices).toEqual({});
    });
  });

  describe('getTokenPrice', () => {
    it('should return price for known token', async () => {
      const mockResponse = {
        polkadot: { usd: 7.5, usd_24h_change: 2.5 },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const price = await getTokenPrice('DOT');
      expect(price).toBe(7.5);
    });

    it('should return 0 for unknown token', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const price = await getTokenPrice('UNKNOWN');
      expect(price).toBe(0);
    });
  });

  describe('calculatePortfolioValue', () => {
    it('should return zero for empty coin array', async () => {
      const result = await calculatePortfolioValue([]);
      expect(result.totalValue).toBe(0);
      expect(result.coinsWithPrices).toEqual([]);
    });

    it('should calculate total portfolio value', async () => {
      const mockResponse = {
        polkadot: { usd: 10, usd_24h_change: 5 },
        tether: { usd: 1, usd_24h_change: 0 },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await calculatePortfolioValue(testCoins);

      // DOT: 10.5 * $10 = $105, USDt: 100 * $1 = $100
      expect(result.totalValue).toBe(205);
    });

    it('should update coin fiat values', async () => {
      const mockResponse = {
        polkadot: { usd: 10, usd_24h_change: 5 },
        tether: { usd: 1, usd_24h_change: 0 },
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await calculatePortfolioValue(testCoins);

      const dotCoin = result.coinsWithPrices.find((c) => c.ticker === 'DOT');
      expect(dotCoin?.fiatValue).toBe(105); // 10.5 * $10
      expect(dotCoin?.change).toBe(5);
    });

    it('should handle missing prices gracefully', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('API Error'));

      const result = await calculatePortfolioValue([
        { ticker: 'UNKNOWN', amount: 100, change: 0, symbol: '', fiatValue: 0 },
      ]);

      // Should not throw, just return 0 values
      expect(result.totalValue).toBe(0);
    });
  });

  describe('filterTransactionsByMonth', () => {
    const txJan2024: (typeof testTransactions)[0] = {
      ...testTransactions[0],
      timestamp: '2024-01-15T12:00:00.000Z',
    };

    const txFeb2024: (typeof testTransactions)[0] = {
      ...testTransactions[0],
      id: 'tx_feb',
      timestamp: '2024-02-20T12:00:00.000Z',
    };

    const txJan2023: (typeof testTransactions)[0] = {
      ...testTransactions[0],
      id: 'tx_jan_2023',
      timestamp: '2023-01-15T12:00:00.000Z',
    };

    const transactions = [txJan2024, txFeb2024, txJan2023];

    it('should filter transactions by year and month', () => {
      const filtered = filterTransactionsByMonth(transactions, 2024, 1);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(txJan2024.id);
    });

    it('should return empty array when no matches', () => {
      const filtered = filterTransactionsByMonth(transactions, 2025, 1);
      expect(filtered).toHaveLength(0);
    });

    it('should handle month correctly (1-indexed)', () => {
      const filtered = filterTransactionsByMonth(transactions, 2024, 2);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tx_feb');
    });

    it('should return empty array for empty input', () => {
      const filtered = filterTransactionsByMonth([], 2024, 1);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('calculateTransactionTotals', () => {
    const sentTx: (typeof testTransactions)[0] = {
      ...testTransactions[0],
      type: 'sent',
      ticker: 'DOT',
      amount: 5,
    };

    const receivedTx: (typeof testTransactions)[0] = {
      ...testTransactions[0],
      id: 'tx_received',
      type: 'received',
      ticker: 'DOT',
      amount: 10,
    };

    const usdtTx: (typeof testTransactions)[0] = {
      ...testTransactions[0],
      id: 'tx_usdt',
      type: 'sent',
      ticker: 'USDt',
      amount: 100,
    };

    it('should calculate sent and received totals', () => {
      const totals = calculateTransactionTotals([sentTx, receivedTx]);
      expect(totals.sent).toBe(5);
      expect(totals.received).toBe(10);
    });

    it('should filter by ticker when provided', () => {
      const totals = calculateTransactionTotals([sentTx, receivedTx, usdtTx], 'DOT');
      expect(totals.sent).toBe(5); // Only DOT sent
      expect(totals.received).toBe(10); // Only DOT received
    });

    it('should return zeros for empty array', () => {
      const totals = calculateTransactionTotals([]);
      expect(totals.sent).toBe(0);
      expect(totals.received).toBe(0);
    });

    it('should accumulate multiple transactions', () => {
      const multipleSent = [
        { ...sentTx, amount: 5 },
        { ...sentTx, id: 'tx2', amount: 10 },
        { ...sentTx, id: 'tx3', amount: 15 },
      ];

      const totals = calculateTransactionTotals(multipleSent);
      expect(totals.sent).toBe(30);
      expect(totals.received).toBe(0);
    });
  });
});
