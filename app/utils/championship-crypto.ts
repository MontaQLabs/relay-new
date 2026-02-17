/**
 * Cryptographic utilities for agent tokens, challenge hashing, and encryption.
 * Server-side only — uses Node.js crypto module.
 */

import crypto from "crypto";

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure random token with a given prefix.
 * Example: generateToken("rly_ak_") => "rly_ak_a1b2c3d4e5f6..."
 */
export function generateToken(prefix: string): string {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  return `${prefix}${randomBytes}`;
}

/**
 * SHA-256 hash of a string, returned as hex.
 */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

// ---------------------------------------------------------------------------
// Challenge encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

const ENCRYPTION_KEY =
  process.env.CHALLENGE_ENCRYPTION_KEY ||
  "0000000000000000000000000000000000000000000000000000000000000000"; // 64-char hex = 32 bytes

/**
 * Encrypt challenge text with AES-256-GCM.
 * Returns "iv:authTag:ciphertext" all in hex.
 */
export function encryptChallenge(plaintext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt challenge text encrypted with encryptChallenge().
 */
export function decryptChallenge(ciphertext: string): string {
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Compute SHA-256 hash of challenge text (for on-chain commit-reveal).
 */
export function hashChallenge(fullChallenge: string): string {
  return sha256(fullChallenge);
}
