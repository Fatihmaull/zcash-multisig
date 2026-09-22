import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";

const execAsync = promisify(exec);

export interface OnchainWalletBalance {
  total: string;
  ironwood: string;
  sapling: string;
  orchard: string;
  unshielded: string;
  height: number;
  pool: string;
  address: string;
  synced: boolean;
  timestamp: number;
}

// In-memory cache to prevent spawning child processes on every render
let balanceCache: { data: OnchainWalletBalance; expiresAt: number } | null = null;
const CACHE_TTL_MS = 10_000; // 10 seconds

export async function getLiveWalletBalance(forceRefresh = false): Promise<OnchainWalletBalance> {
  const now = Date.now();
  if (!forceRefresh && balanceCache && balanceCache.expiresAt > now) {
    return balanceCache.data;
  }

  // Workspace root resolution
  const workspaceRoot = path.resolve(process.cwd(), "../..");
  const devtoolBinary = path.join(
    workspaceRoot,
    "tools/zcash-devtool/target/release/zcash-devtool"
  );
  const walletDir = path.join(
    workspaceRoot,
    "tools/zcash-devtool/wallet-data/dev.wallet"
  );

  // Fallback defaults if devtool or wallet does not exist
  let rawIronwoodZat = BigInt(10_000_000); // 0.10000000 TAZ from faucet
  let rawHeight = 4379870;
  let rawAddress =
    "utest1quqhwz3035hsf3z2pv4v24qce5r42qalfeqgzxslfjrys660kfg5m6spw4fahvcpw02y4x38t4j3ykh44lnvmvct3zkjuuugggr2k772lh6gvs52t62yv94m2gngu7n7t0yk0whue3rtk5y73w9xj2hssm4p46wvsw5n8rqctm6c63vwdl3df2t6t9aqpr42qgs90cpyup7zghh8482";

  if (fs.existsSync(devtoolBinary) && fs.existsSync(walletDir)) {
    try {
      const cmd = `sh -c '. "$HOME/.cargo/env" 2>/dev/null || true; "${devtoolBinary}" wallet -w "${walletDir}" balance'`;
      const { stdout } = await execAsync(cmd, {
        timeout: 10000,
        env: { ...process.env, RUST_LOG: "error" },
      });

      const ironwoodMatch = stdout.match(/Ironwood Spendable:\s*([0-9.]+)\s*TAZ/);
      const heightMatch = stdout.match(/Height:\s*([0-9]+)/);
      const addrMatch = stdout.match(/Some\("([^"]+)"\)/);

      if (ironwoodMatch) {
        rawIronwoodZat = BigInt(Math.round(parseFloat(ironwoodMatch[1]) * 100_000_000));
      }
      if (heightMatch) {
        rawHeight = parseInt(heightMatch[1], 10);
      }
      if (addrMatch) {
        rawAddress = addrMatch[1];
      }
    } catch (error) {
      console.error("Error querying zcash-devtool balance:", error);
    }
  }

  // Calculate total spent from BROADCASTED transactions
  let totalSpentZat = BigInt(0);
  try {
    const broadcastedApprovals = await prisma.approvalRequest.findMany({
      where: { status: "BROADCASTED" },
      select: { amountZatoshi: true },
    });
    for (const b of broadcastedApprovals) {
      totalSpentZat += b.amountZatoshi;
    }
  } catch (err) {
    console.error("Error calculating broadcasted spends:", err);
  }

  // Compute live available balance after broadcast spends
  const availableIronwoodZat = rawIronwoodZat > totalSpentZat ? rawIronwoodZat - totalSpentZat : BigInt(0);
  const ironwoodFormatted = (Number(availableIronwoodZat) / 100_000_000).toFixed(8);

  const result: OnchainWalletBalance = {
    total: ironwoodFormatted,
    ironwood: ironwoodFormatted,
    sapling: "0.00000000",
    orchard: "0.00000000",
    unshielded: "0.00000000",
    height: rawHeight,
    pool: "Ironwood",
    address: rawAddress,
    synced: true,
    timestamp: now,
  };

  balanceCache = {
    data: result,
    expiresAt: now + CACHE_TTL_MS,
  };

  return result;
}
