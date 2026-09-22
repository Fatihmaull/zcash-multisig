// ──────────────────────────────────────────────────────────────
// Quorum — Broadcast & Confirmation Tracking API
//
// P1-B2: REST endpoint for broadcasting signed transactions and
// retrieving the Ironwood anchor (tree state) for deferred anchor
// binding at broadcast time (constraint C3).
//
// POST /api/broadcast          — broadcast a raw signed transaction
// GET  /api/broadcast?action=anchor  — get latest Ironwood anchor
// GET  /api/broadcast?action=status&txid=<hex> — check confirmation
//
// This route talks to the lightwalletd endpoint configured in .env.
// It does NOT hold key material or sign anything.
// ──────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import {
  broadcastTransaction,
  getLatestBlockHeight,
  getTreeState,
  getEndpoint,
} from "@/lib/zcash-node";

export const dynamic = "force-dynamic";

/**
 * GET /api/broadcast
 *
 * Query params:
 *   action=anchor  — returns the latest Ironwood tree state for anchor binding
 *   action=status&txid=<hex> — returns confirmation status (placeholder)
 *   action=info    — returns endpoint info and latest block height
 */
export async function GET(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");

  try {
    switch (action) {
      case "anchor": {
        const block = await getLatestBlockHeight();
        const tree = await getTreeState(block.height);
        return NextResponse.json({
          blockHeight: block.height,
          blockHash: block.hash,
          ironwoodTree: tree.ironwoodTree,
          orchardTree: tree.orchardTree,
          saplingTree: tree.saplingTree,
          timestamp: new Date().toISOString(),
        });
      }

      case "status": {
        const txid = request.nextUrl.searchParams.get("txid");
        if (!txid) {
          return NextResponse.json(
            { error: "Missing txid parameter" },
            { status: 400 }
          );
        }
        // Placeholder: full confirmation tracking requires indexer queries
        // that are not yet available. For now, return a mock status.
        // P1-B2 will be fully implemented when Zaino integration lands.
        return NextResponse.json({
          txid,
          confirmed: false,
          confirmations: 0,
          message:
            "Confirmation tracking requires Zaino indexer. Currently returning placeholder status.",
        });
      }

      case "info":
      default: {
        const block = await getLatestBlockHeight();
        return NextResponse.json({
          endpoint: getEndpoint(),
          network: "testnet",
          latestBlockHeight: block.height,
          ironwoodActivation: 4_134_000,
          blocksSinceIronwood: block.height - 4_134_000,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: `Endpoint unreachable: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
        endpoint: getEndpoint(),
      },
      { status: 502 }
    );
  }
}

/**
 * POST /api/broadcast
 *
 * Body: { rawTxHex: string }
 *
 * Broadcasts a fully signed transaction (with anchor bound) to the
 * Zcash testnet via the lightwalletd SendTransaction RPC.
 *
 * The anchor must already be set in the transaction before calling
 * this endpoint. Use GET ?action=anchor to retrieve the latest
 * Ironwood tree state for anchor binding.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawTxHex } = body;

    if (!rawTxHex || typeof rawTxHex !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid rawTxHex in request body" },
        { status: 400 }
      );
    }

    // Validate hex format
    if (!/^[0-9a-fA-F]+$/.test(rawTxHex)) {
      return NextResponse.json(
        { error: "rawTxHex must be a valid hex string" },
        { status: 400 }
      );
    }

    const result = await broadcastTransaction(rawTxHex);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      txid: result.txid,
      message: "Transaction broadcast to testnet. Check confirmation status with GET ?action=status&txid=<txid>",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Broadcast failed: ${
          error instanceof Error ? error.message : "Internal error"
        }`,
      },
      { status: 500 }
    );
  }
}
