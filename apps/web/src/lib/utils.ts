// ──────────────────────────────────────────────────────────────
// Quorum — Utility Functions
// ──────────────────────────────────────────────────────────────

/**
 * Convert zatoshi (integer) to ZEC (display).
 * 1 ZEC = 100_000_000 zatoshi
 */
export function zatoshiToZec(zatoshi: bigint | number): string {
  const z = typeof zatoshi === "bigint" ? zatoshi : BigInt(zatoshi);
  const whole = z / BigInt(100_000_000);
  const frac = z % BigInt(100_000_000);
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

/**
 * Convert ZEC (string) to zatoshi (BigInt).
 */
export function zecToZatoshi(zec: string): bigint {
  const parts = zec.split(".");
  const whole = BigInt(parts[0] || "0") * BigInt(100_000_000);
  if (parts[1]) {
    const frac = parts[1].padEnd(8, "0").slice(0, 8);
    return whole + BigInt(frac);
  }
  return whole;
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Truncate a hex string (address, txid, public key) for display.
 */
export function truncateHex(hex: string, chars: number = 8): string {
  if (hex.length <= chars * 2 + 3) return hex;
  return `${hex.slice(0, chars)}...${hex.slice(-chars)}`;
}

/**
 * CSS class merger.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
