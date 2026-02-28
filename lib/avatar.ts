/**
 * Avatar utility functions using DiceBear API
 */

type DiceBearStyle = "avataaars" | "shapes" | "identicon" | "bottts" | "lorelei" | "notionists";

/**
 * Generate a DiceBear avatar URL
 * @param seed - Seed string for consistent avatar generation (usually wallet address)
 * @param style - DiceBear style to use (default: avataaars)
 * @returns Avatar URL string
 */
export const getDiceBearAvatar = (seed: string, style: DiceBearStyle = "avataaars"): string => {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};

/**
 * Get user avatar URL with fallback to DiceBear
 * @param avatar - User's custom avatar URL (may be empty)
 * @param seed - Fallback seed for DiceBear (usually wallet address)
 * @returns Avatar URL string
 */
export const getAvatarUrl = (avatar: string | undefined, seed: string): string => {
  if (avatar && avatar.trim()) return avatar;
  return getDiceBearAvatar(seed);
};

/**
 * Get random avatar for community/activity using shapes style
 * @param seed - Seed string
 * @returns Avatar URL string
 */
export const getRandomAvatar = (seed: string): string => {
  return getDiceBearAvatar(seed, "shapes");
};
