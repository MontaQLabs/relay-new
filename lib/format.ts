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
export const formatDate = (timestamp: string, options?: Intl.DateTimeFormatOptions): string => {
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
export const formatCryptoAmount = (value: number, maxDecimals: number = 4): string => {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: maxDecimals,
  });
};

// ===== Staking Formatting Helpers =====

/**
 * Format a commission rate (0-1) as a percentage
 * @param rate - Commission rate between 0 and 1
 * @returns Formatted percentage string (e.g., "5.5%")
 */
export const formatCommission = (rate: number): string => {
  const percentage = rate * 100;
  if (percentage === 0) return "0%";
  if (percentage < 0.01) return "<0.01%";
  return `${percentage.toFixed(percentage < 1 ? 2 : 1)}%`;
};

/**
 * Format a DOT amount for staking display
 * @param amount - Amount in DOT (already converted from planck)
 * @returns Formatted DOT string with appropriate precision
 */
export const formatStakingAmount = (amount: number): string => {
  if (amount === 0) return "0";
  if (amount < 0.0001) return "<0.0001";
  if (amount < 1) return amount.toFixed(4);
  if (amount < 100) return amount.toFixed(2);
  return amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
};

/**
 * Format pool member count
 * @param count - Number of members
 * @returns Formatted count string
 */
export const formatMemberCount = (count: number): string => {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
};

/**
 * Format total bonded amount for pools (usually large numbers)
 * @param amount - Amount in DOT
 * @returns Formatted string (e.g., "1.2M DOT")
 */
export const formatPoolBond = (amount: number): string => {
  if (amount < 1000) return `${formatStakingAmount(amount)} DOT`;
  if (amount < 1000000) return `${(amount / 1000).toFixed(1)}K DOT`;
  return `${(amount / 1000000).toFixed(2)}M DOT`;
};

/**
 * Calculate approximate time until era unlocks
 * Polkadot has ~24 hour eras, with 28 era unbonding period
 * @param currentEra - Current era number
 * @param unlockEra - Era when funds unlock
 * @returns Human readable time string
 */
export const formatUnlockTime = (currentEra: number, unlockEra: number): string => {
  const erasRemaining = unlockEra - currentEra;
  if (erasRemaining <= 0) return "Ready to withdraw";

  // Each era is approximately 24 hours on Polkadot
  const hoursRemaining = erasRemaining * 24;

  if (hoursRemaining < 24) return `~${hoursRemaining} hours`;
  const daysRemaining = Math.ceil(hoursRemaining / 24);
  return `~${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
};

// ===== DOT / Planck Conversion Helpers =====

/** 1 DOT = 10^10 planck */
const PLANCK_PER_DOT = 10_000_000_000;

/**
 * Convert a DOT amount (human-readable, e.g. "1.5") to planck (string).
 * Handles up to 10 decimal places without floating-point drift.
 * @param dot - DOT amount as a string, e.g. "1.5", "0.001"
 * @returns planck value as a string, e.g. "15000000000"
 */
export const dotToPlanck = (dot: string): string => {
  if (!dot || dot.trim() === "") return "0";

  const trimmed = dot.trim();
  const parts = trimmed.split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").padEnd(10, "0").slice(0, 10); // exactly 10 decimals

  // whole * 10^10  +  fractional part (already scaled)
  const wholeBig = BigInt(whole) * BigInt(PLANCK_PER_DOT);
  const fracBig = BigInt(frac);

  return (wholeBig + fracBig).toString();
};

/**
 * Convert a planck amount (string) to DOT (human-readable string).
 * @param planck - planck value as a string, e.g. "15000000000"
 * @returns DOT amount as a string, e.g. "1.5"
 */
export const planckToDot = (planck: string): string => {
  if (!planck || planck.trim() === "" || planck === "0") return "0";

  try {
    const val = BigInt(planck);
    const whole = val / BigInt(PLANCK_PER_DOT);
    const remainder = val % BigInt(PLANCK_PER_DOT);

    if (remainder === BigInt(0)) {
      return whole.toString();
    }

    // Pad remainder to 10 digits, then strip trailing zeros
    const fracStr = remainder.toString().padStart(10, "0").replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  } catch {
    return "0";
  }
};

/**
 * Format a planck amount as a human-readable DOT string for display.
 * @param planck - planck value as a string
 * @returns formatted string like "1.50 DOT" or "0.0012 DOT"
 */
export const formatPlanckAsDot = (planck: string): string => {
  if (!planck || planck === "0") return "0 DOT";

  try {
    const val = Number(BigInt(planck)) / PLANCK_PER_DOT;
    if (val >= 1) return `${val.toFixed(2)} DOT`;
    if (val > 0) return `${val.toFixed(4)} DOT`;
    return "0 DOT";
  } catch {
    return "0 DOT";
  }
};
