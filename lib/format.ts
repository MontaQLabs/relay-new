/**
 * Formatting utility functions
 */

/**
 * Truncate a wallet address for display
 * @param address - The full wallet address
 * @param startChars - Number of characters to show at start (default: 8)
 * @param endChars - Number of characters to show at end (default: 6)
 * @returns Truncated address string
 */
export const truncateAddress = (
  address: string,
  startChars: number = 8,
  endChars: number = 6
): string => {
  if (!address) return "";
  if (address.length <= startChars + endChars + 4) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Format a timestamp to display time in HH:MM format
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string
 */
export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/**
 * Format a timestamp to display date
 * @param timestamp - ISO timestamp string
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export const formatDate = (
  timestamp: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString(
    "en-US",
    options || {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
};

/**
 * Format a number as currency
 * @param value - The numeric value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number, decimals: number = 2): string => {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format a crypto amount with appropriate precision
 * @param value - The numeric value
 * @param maxDecimals - Maximum decimal places (default: 4)
 * @returns Formatted amount string
 */
export const formatCryptoAmount = (
  value: number,
  maxDecimals: number = 4
): string => {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxDecimals,
  });
};
