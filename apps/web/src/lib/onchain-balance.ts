import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export interface OnchainWalletBalance {
  total: string;
  ironwood: string;
  sapling: string | null;
  orchard: string | null;
  unshielded: string | null;
  /** Null when the balance command did not report a height. */
  height: number | null;
  pool: string;
  address: string;
  synced: boolean;
  timestamp: number;
}

let balanceCache: { data: OnchainWalletBalance | null; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10_000;

/**
 * Parse a TAZ decimal into zatoshi without binary floating point, then format
 * back to 8 decimal places. That is the zatoshi scale, not a rounded reading.
 */
function formatTaz(value: string): string | null {
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, frac = ""] = value.split(".");
  const digits = (frac + "00000000").slice(0, 8);
  const zat = BigInt(whole) * 100_000_000n + BigInt(digits);
  const abs = zat < 0n ? -zat : zat;
  const w = abs / 100_000_000n;
  const f = (abs % 100_000_000n).toString().padStart(8, "0");
  return `${w.toString()}.${f}`;
}

/**
 * The Ironwood balance of one vault, or null when we cannot honestly say.
 *
 * A shielded balance cannot be read from an address. This returns a number
 * only when the local `zcash-devtool` wallet reports an address equal to
 * this vault's, which is what a viewing-key scan of this vault looks like.
 * There is no hardcoded stand-in.
 */
export async function getVaultIronwoodBalance(
  shieldedAddress: string | null | undefined
): Promise<{ ironwood: string; height: number | null; source: string } | null> {
  if (!shieldedAddress) return null;
  const wallet = await getLiveWalletBalance();
  if (!wallet?.address || wallet.address !== shieldedAddress || !wallet.ironwood) return null;
  return {
    ironwood: wallet.ironwood,
    height: wallet.height,
    source: "local zcash-devtool wallet, synced from this vault's viewing key",
  };
}

/**
 * The operator's local devtool wallet, or null.
 *
 * Null is the result when the binary or the wallet is absent, or when the
 * command does not report both an Ironwood figure and an address. Callers
 * must not substitute a number. Broadcast rows in the database are not
 * subtracted: that remainder was never a chain reading.
 */
export async function getLiveWalletBalance(
  forceRefresh = false
): Promise<OnchainWalletBalance | null> {
  const now = Date.now();
  if (!forceRefresh && balanceCache && balanceCache.expiresAt > now) {
    return balanceCache.data;
  }

  const workspaceRoot = path.resolve(process.cwd(), "../..");
  const devtoolBinary = path.join(
    workspaceRoot,
    "tools/zcash-devtool/target/release/zcash-devtool"
  );
  const walletDir = path.join(
    workspaceRoot,
    "tools/zcash-devtool/wallet-data/dev.wallet"
  );

  const store = (data: OnchainWalletBalance | null) => {
    balanceCache = { data, expiresAt: now + CACHE_TTL_MS };
    return data;
  };

  if (!fs.existsSync(devtoolBinary) || !fs.existsSync(walletDir)) {
    return store(null);
  }

  try {
    const cmd = `sh -c '. "$HOME/.cargo/env" 2>/dev/null || true; "${devtoolBinary}" wallet -w "${walletDir}" balance'`;
    const { stdout } = await execAsync(cmd, {
      timeout: 10000,
      env: { ...process.env, RUST_LOG: "error" },
    });

    const ironwoodMatch = stdout.match(/Ironwood Spendable:\s*([0-9.]+)\s*TAZ/);
    const heightMatch = stdout.match(/Height:\s*([0-9]+)/);
    const addrMatch = stdout.match(/Some\("([^"]+)"\)/);
    const ironwood = ironwoodMatch ? formatTaz(ironwoodMatch[1]) : null;
    const address = addrMatch?.[1] ?? null;

    if (!ironwood || !address) {
      return store(null);
    }

    const saplingMatch = stdout.match(/Sapling Spendable:\s*([0-9.]+)\s*TAZ/);
    const orchardMatch = stdout.match(/Orchard Spendable:\s*([0-9.]+)\s*TAZ/);
    const transparentMatch = stdout.match(/Transparent:\s*([0-9.]+)\s*TAZ/);

    return store({
      total: ironwood,
      ironwood,
      sapling: saplingMatch ? formatTaz(saplingMatch[1]) : null,
      orchard: orchardMatch ? formatTaz(orchardMatch[1]) : null,
      unshielded: transparentMatch ? formatTaz(transparentMatch[1]) : null,
      height: heightMatch ? parseInt(heightMatch[1], 10) : null,
      pool: "Ironwood",
      address,
      synced: true,
      timestamp: now,
    });
  } catch (error) {
    console.error("Error querying zcash-devtool balance:", error);
    return store(null);
  }
}
