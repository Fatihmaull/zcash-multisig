// ──────────────────────────────────────────────────────────────
// Viewing key encryption at rest
//
// A Zcash full viewing key does not grant spend authority, but it does
// reveal the vault's entire transaction history — every amount, every
// counterparty. For a privacy product, storing one in a plaintext
// database column is a breach waiting to happen.
//
// WHAT THIS PROTECTS AGAINST
//   A leaked database dump, a misconfigured backup, a stolen replica —
//   anywhere the rows travel without the application's environment.
//
// WHAT THIS DOES NOT PROTECT AGAINST
//   An attacker holding BOTH the database and VIEWING_KEY_ENCRYPTION_KEY.
//   This is envelope encryption with a single application key, not a KMS
//   or an HSM. Do not describe it as more than it is.
//
// NEVER used for key shares or spend authorizing keys. Those must never
// reach the server in any form, encrypted or otherwise.
// See docs/03-architecture.md §2 and §4.
// ──────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit nonce, the standard size for GCM
const KEY_BYTES = 32; // AES-256
const FORMAT_VERSION = "v1";

/**
 * Loads the encryption key from the environment.
 *
 * Fails loudly rather than falling back to a default. A silent fallback
 * in this position would mean viewing keys quietly stored under a key
 * an attacker can read from the source tree.
 */
function loadKey(): Buffer {
  const encoded = process.env.VIEWING_KEY_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error(
      "VIEWING_KEY_ENCRYPTION_KEY is not set. Generate one with:\n" +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `VIEWING_KEY_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}.`,
    );
  }
  return key;
}

/**
 * Encrypts a viewing key for storage.
 *
 * Output format: `v1:<iv>:<authTag>:<ciphertext>`, each part base64.
 * The version prefix exists so the format can be rotated later without
 * guessing at what old rows contain.
 */
export function encryptViewingKey(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  // GCM's auth tag is what makes this tamper-evident: decryption fails
  // if the stored row was modified.
  const authTag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decrypts a stored viewing key. Throws if the row was tampered with. */
export function decryptViewingKey(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error(
      `Unrecognised viewing key format. Expected "${FORMAT_VERSION}:<iv>:<tag>:<ct>".`,
    );
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    loadKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
