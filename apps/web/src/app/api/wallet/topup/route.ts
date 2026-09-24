import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const amountTAZ = Number(body.amount ?? 0.1);
    const action = body.action || "reset"; // "reset" or "topup"

    if (isNaN(amountTAZ) || amountTAZ <= 0) {
      return NextResponse.json(
        { success: false, error: "Nominal TAZ tidak valid" },
        { status: 400 }
      );
    }

    // 1. Reset broadcasted approval requests if action is reset (kembalikan saldo utuh)
    let clearedCount = 0;
    if (action === "reset") {
      const deleted = await prisma.approvalRequest.deleteMany({
        where: { status: "BROADCASTED" },
      });
      clearedCount = deleted.count;
    }

    // 2. Optional: If dev wallet sync is requested
    const workspaceRoot = path.resolve(process.cwd(), "../..");
    const devtoolBinary = path.join(
      workspaceRoot,
      "tools/zcash-devtool/target/release/zcash-devtool"
    );
    const walletDir = path.join(
      workspaceRoot,
      "tools/zcash-devtool/wallet-data/dev.wallet"
    );

    let syncResult = "skipped";
    if (fs.existsSync(devtoolBinary) && fs.existsSync(walletDir) && body.syncChain) {
      try {
        const cmd = `sh -c '. "$HOME/.cargo/env" 2>/dev/null || true; "${devtoolBinary}" wallet -w "${walletDir}" sync'`;
        await execAsync(cmd, { timeout: 30000 });
        syncResult = "synced";
      } catch (e) {
        console.error("Chain sync error:", e);
        syncResult = "error";
      }
    }

    return NextResponse.json({
      success: true,
      message: action === "reset" 
        ? `Saldo berhasil direset ke saldo penuh on-chain dev wallet (${clearedCount} transaksi broadcast dibersihkan).`
        : `Saldo berhasil diperbarui.`,
      clearedBroadcasts: clearedCount,
      syncResult,
    });
  } catch (error) {
    console.error("Topup / reset error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Gagal memperbarui saldo",
      },
      { status: 500 }
    );
  }
}
