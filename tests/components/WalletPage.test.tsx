/**
 * Component tests for WalletPage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../setup/test-utils';
import { WALLET_KEY, IS_BACKED_UP_KEY } from '@/app/types/constants';
import { testWallet, testCoins, testKnownAssets } from '../setup/fixtures';

// Mock crypto utilities
const mockFetchDotCoins = vi.fn();
const mockCalculatePortfolioValue = vi.fn();
const mockFetchAllChainBalances = vi.fn();

vi.mock('@/app/utils/crypto', () => ({
  fetchDotCoins: (...args: unknown[]) => mockFetchDotCoins(...args),
  calculatePortfolioValue: (...args: unknown[]) => mockCalculatePortfolioValue(...args),
  fetchAllChainBalances: () => mockFetchAllChainBalances(),
}));

// Mock defillama
vi.mock('@/app/utils/defillama', () => ({
  fetchProtocolsTvl: vi.fn().mockResolvedValue(new Map()),
  formatTvl: (tvl: number) => `$${(tvl / 1e6).toFixed(2)}M`,
}));

// Mock supabase
const mockGetKnownAssets = vi.fn();
const mockGetEcosystemProjects = vi.fn();

vi.mock('@/app/db/supabase', () => ({
  getKnownAssets: () => mockGetKnownAssets(),
  getEcosystemProjects: () => mockGetEcosystemProjects(),
}));

// Import after mocking
import WalletPage from '@/app/dashboard/wallet/page';
import { mockRouter } from '../setup/test-utils';

describe('WalletPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(WALLET_KEY, JSON.stringify(testWallet));

    // Default mock implementations
    mockGetKnownAssets.mockResolvedValue(testKnownAssets);
    mockGetEcosystemProjects.mockResolvedValue([
      {
        id: '1',
        name: 'Jupiter',
        slug: 'jupiter',
        description: 'Leading DEX aggregator on Solana',
        chainId: 'solana',
        category: 'dex',
        logoUrl: 'https://example.com/jup.png',
        websiteUrl: 'https://jup.ag',
        featured: true,
      },
    ]);
    mockFetchAllChainBalances.mockResolvedValue({});
    mockFetchDotCoins.mockResolvedValue(testCoins);
    mockCalculatePortfolioValue.mockResolvedValue({
      totalValue: 175.25,
      coinsWithPrices: testCoins,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render balance card', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Balance')).toBeInTheDocument();
      });
    });

    it('should render portfolio section', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Portfolio')).toBeInTheDocument();
      });
    });

    it('should render Explore section', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Explore')).toBeInTheDocument();
      });
    });

    it('should render action buttons', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Scan')).toBeInTheDocument();
        expect(screen.getByText('Receive')).toBeInTheDocument();
        expect(screen.getByText('Send')).toBeInTheDocument();
      });
    });
  });

  describe('Balance Display', () => {
    it('should display balance section', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Balance')).toBeInTheDocument();
      });
    });

    it('should display formatted balance after loading', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        // Check for dollar sign which indicates balance is displayed
        expect(screen.getByText(/\$175\.25/)).toBeInTheDocument();
      });
    });

    it('should toggle balance visibility', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText(/\$175\.25/)).toBeInTheDocument();
      });

      // Find and click the eye button
      const eyeButton = screen.getByLabelText(/hide balance/i);
      await act(async () => {
        fireEvent.click(eyeButton);
      });

      expect(screen.getByText('••••••••')).toBeInTheDocument();

      // Click again to show
      const showButton = screen.getByLabelText(/show balance/i);
      await act(async () => {
        fireEvent.click(showButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/\$175\.25/)).toBeInTheDocument();
      });
    });
  });

  describe('Portfolio Section', () => {
    it('should show empty state when no coins', async () => {
      mockFetchDotCoins.mockResolvedValue([]);
      mockCalculatePortfolioValue.mockResolvedValue({
        totalValue: 0,
        coinsWithPrices: [],
      });

      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('No assets yet')).toBeInTheDocument();
      });
    });

    it('should display coin tickers after loading', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        // DOT should appear in Portfolio section
        expect(screen.getByText('DOT')).toBeInTheDocument();
      });
    });

    it('should show DOT coin amount', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('10.5')).toBeInTheDocument(); // DOT amount
      });
    });

    it('should show USDt coin amount', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('100')).toBeInTheDocument(); // USDt amount
      });
    });
  });

  describe('Explore Section', () => {
    it('should display explore section with projects', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Explore')).toBeInTheDocument();
      });
    });

    it('should show project names after loading', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Jupiter')).toBeInTheDocument();
      });
    });
  });

  describe('Protect Wallet Banner', () => {
    it('should show banner when wallet is not backed up', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Protect your wallet')).toBeInTheDocument();
      });
    });

    it('should hide banner when wallet is backed up', async () => {
      localStorage.setItem(IS_BACKED_UP_KEY, 'true');

      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.queryByText('Protect your wallet')).not.toBeInTheDocument();
      });
    });

    it('should navigate to settings on Save Secret click', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Save Secret')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Save Secret'));
      });

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/settings');
    });

    it('should dismiss banner on X click', async () => {
      await act(async () => {
        render(<WalletPage />);
      });

      await waitFor(() => {
        expect(screen.getByText('Protect your wallet')).toBeInTheDocument();
      });

      const dismissButton = screen.getByLabelText('Dismiss');
      await act(async () => {
        fireEvent.click(dismissButton);
      });

      expect(screen.queryByText('Protect your wallet')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch error gracefully', async () => {
      mockFetchDotCoins.mockRejectedValue(new Error('Network error'));
      mockGetKnownAssets.mockRejectedValue(new Error('Network error'));
      mockGetEcosystemProjects.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        render(<WalletPage />);
      });

      // Should still render the page without crashing
      await waitFor(() => {
        expect(screen.getByText('Portfolio')).toBeInTheDocument();
      });
    });

    it('should handle price fetch error gracefully', async () => {
      mockCalculatePortfolioValue.mockRejectedValue(new Error('Price API error'));

      await act(async () => {
        render(<WalletPage />);
      });

      // Should still render with fallback values
      await waitFor(() => {
        expect(screen.getByText('Balance')).toBeInTheDocument();
      });
    });
  });
});
