/**
 * Shared color constants for the application
 */

// Color mapping for common crypto tickers
export const COIN_COLORS: Record<string, { bg: string; color: string }> = {
  ETH: { bg: "#627eea", color: "#ffffff" },
  ETC: { bg: "#3ab83a", color: "#ffffff" },
  ZEC: { bg: "#f4b728", color: "#1a1a1a" },
  XMR: { bg: "#ff6600", color: "#ffffff" },
  BTC: { bg: "#f7931a", color: "#ffffff" },
  USDT: { bg: "#26a17b", color: "#ffffff" },
  USDt: { bg: "#26a17b", color: "#ffffff" },
  USDC: { bg: "#2775ca", color: "#ffffff" },
  DOT: { bg: "#e6007a", color: "#ffffff" },
  SOL: { bg: "#9945ff", color: "#ffffff" },
  DEFAULT: { bg: "#6366f1", color: "#ffffff" },
};

// Get coin colors with fallback to default
export const getCoinColors = (ticker: string) => {
  return COIN_COLORS[ticker] || COIN_COLORS.DEFAULT;
};
