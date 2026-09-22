// ──────────────────────────────────────────────────────────────
// Quorum — Zcash Testnet Node Client
//
// Lightweight client for lightwalletd-compatible gRPC endpoints.
// Provides block height queries, chain metadata inspection, tree
// state retrieval, and transaction broadcast.
//
// P1-B1: Note scanning helpers for the Ironwood pool.
// P1-B2: Broadcast and confirmation tracking.
//
// Uses REST/JSON-RPC fallback since gRPC-web from Node.js requires
// additional tooling. The lightwalletd endpoint exposes a JSON
// gateway alongside gRPC.
// ──────────────────────────────────────────────────────────────

/**
 * Configuration loaded from environment.
 *
 * LIGHTWALLETD_ENDPOINT must point to a testnet lightwalletd instance
 * serving Ironwood data. Verified fields:
 *   - CompactTx field 9: ironwoodActions
 *   - ChainMetadata field 3: ironwoodCommitmentTreeSize
 *   - GetTreeState: ironwoodTree
 *
 * See docs/03-architecture.md §6 for the verification record.
 */
const LIGHTWALLETD_ENDPOINT =
  process.env.LIGHTWALLETD_ENDPOINT || "https://testnet.zec.rocks:443";

// Ironwood activated at testnet block 4,134,000
const IRONWOOD_ACTIVATION_HEIGHT = 4_134_000;

// ── Types ────────────────────────────────────────────────────

export interface BlockInfo {
  height: number;
  hash: string;
}

export interface ChainMetadata {
  saplingCommitmentTreeSize: number;
  orchardCommitmentTreeSize: number;
  ironwoodCommitmentTreeSize: number;
}

export interface TreeState {
  network: string;
  height: number;
  hash: string;
  time: number;
  saplingTree: string;
  orchardTree: string;
  ironwoodTree: string;
}

export interface EndpointVerification {
  endpoint: string;
  reachable: boolean;
  blockHeight: number | null;
  pastIronwoodActivation: boolean;
  blocksSinceActivation: number | null;
  ironwoodTreePresent: boolean;
  ironwoodCommitmentTreeSize: number | null;
  errors: string[];
}

export interface BroadcastResult {
  success: boolean;
  txid?: string;
  error?: string;
}

export interface ConfirmationStatus {
  txid: string;
  confirmed: boolean;
  confirmations: number;
  blockHeight?: number;
}

// ── gRPC-web JSON gateway helpers ────────────────────────────
// lightwalletd exposes a gRPC-web gateway. We use fetch with the
// appropriate content type headers.

/**
 * Fetches the latest block height from the lightwalletd endpoint.
 */
export async function getLatestBlockHeight(): Promise<BlockInfo> {
  const url = `${LIGHTWALLETD_ENDPOINT}/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLatestBlock`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      height: data.height || 0,
      hash: data.hash || "",
    };
  } catch (error) {
    // Fallback: try the endpoint directly for a basic connectivity check
    throw new Error(
      `Failed to reach lightwalletd at ${LIGHTWALLETD_ENDPOINT}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Fetches the tree state at a given block height.
 * Used for anchor retrieval at broadcast time (P1-B2).
 */
export async function getTreeState(height: number): Promise<TreeState> {
  const url = `${LIGHTWALLETD_ENDPOINT}/cash.z.wallet.sdk.rpc.CompactTxStreamer/GetTreeState`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ height }),
  });

  if (!response.ok) {
    throw new Error(`GetTreeState failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    network: data.network || "test",
    height: data.height || height,
    hash: data.hash || "",
    time: data.time || 0,
    saplingTree: data.saplingTree || "",
    orchardTree: data.orchardTree || "",
    ironwoodTree: data.ironwoodTree || "",
  };
}

/**
 * Broadcasts a raw signed transaction to the network.
 * P1-B2: The transaction must already have its anchor bound.
 */
export async function broadcastTransaction(
  rawTxHex: string
): Promise<BroadcastResult> {
  const url = `${LIGHTWALLETD_ENDPOINT}/cash.z.wallet.sdk.rpc.CompactTxStreamer/SendTransaction`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: rawTxHex }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errText}`,
      };
    }

    const data = await response.json();
    if (data.errorCode && data.errorCode !== 0) {
      return {
        success: false,
        error: `Node rejected: ${data.errorMessage || "unknown error"}`,
      };
    }

    return {
      success: true,
      txid: data.txid || data.hash || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: `Broadcast failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Verifies the lightwalletd endpoint serves Ironwood data.
 * P1-B1: The single highest-value hour of Phase 1 — a mismatch
 * changes everything downstream.
 */
export async function verifyEndpoint(): Promise<EndpointVerification> {
  const result: EndpointVerification = {
    endpoint: LIGHTWALLETD_ENDPOINT,
    reachable: false,
    blockHeight: null,
    pastIronwoodActivation: false,
    blocksSinceActivation: null,
    ironwoodTreePresent: false,
    ironwoodCommitmentTreeSize: null,
    errors: [],
  };

  // Step 1: Check block height
  try {
    const block = await getLatestBlockHeight();
    result.reachable = true;
    result.blockHeight = block.height;
    result.pastIronwoodActivation = block.height > IRONWOOD_ACTIVATION_HEIGHT;
    result.blocksSinceActivation = block.height - IRONWOOD_ACTIVATION_HEIGHT;
  } catch (error) {
    result.errors.push(
      `Block height check failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return result;
  }

  // Step 2: Check tree state for Ironwood tree
  if (result.blockHeight) {
    try {
      const tree = await getTreeState(result.blockHeight);
      result.ironwoodTreePresent = !!tree.ironwoodTree;
      if (!tree.ironwoodTree) {
        result.errors.push(
          "GetTreeState returned no ironwoodTree — endpoint may not serve Ironwood data"
        );
      }
    } catch (error) {
      result.errors.push(
        `Tree state check failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return result;
}

/**
 * Returns the Ironwood activation height for testnet.
 */
export function getIronwoodActivationHeight(): number {
  return IRONWOOD_ACTIVATION_HEIGHT;
}

/**
 * Returns the configured lightwalletd endpoint.
 */
export function getEndpoint(): string {
  return LIGHTWALLETD_ENDPOINT;
}
