// ──────────────────────────────────────────────────────────────
// Quorum — Zcash Testnet Node Client
// Lightweight client for lightwalletd gRPC endpoints over grpc-web+proto.
// Verified 11 Oct 2026: testnet.zec.rocks serves grpc-web+proto only —
// plain JSON gets 404 and JSON bodies under a grpc-web content-type get 415.
// ──────────────────────────────────────────────────────────────
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import http2 from "http2";
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

const IRONWOOD_ACTIVATION_HEIGHT = 4_134_000;

// ── grpc-web+proto transport ─────────────────────────────────
// Wire format per https://github.com/zcash/lightwallet-protocol:
// each call is a single framed message: 0x00 + uint32be length + proto bytes.
// Responses are framed the same way, followed by a 0x80-framed trailer.

function pbVarint(n: number | bigint): Uint8Array {
  let v = BigInt(n);
  const out: number[] = [];
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) byte |= 0x80;
    out.push(byte);
  } while (v > 0n);
  return Uint8Array.from(out);
}

function pbUint(field: number, n: number | bigint): Uint8Array {
  const tag = pbVarint((field << 3) | 0);
  const v = pbVarint(n);
  const out = new Uint8Array(tag.length + v.length);
  out.set(tag, 0);
  out.set(v, tag.length);
  return out;
}


/** Minimal protobuf reader for the fields these RPCs return. */
function pbFields(data: Uint8Array): Map<number, Uint8Array | bigint> {
  const out = new Map<number, Uint8Array | bigint>();
  let i = 0;
  while (i < data.length) {
    let tag = 0n, shift = 0n;
    for (;;) {
      const b = data[i++];
      tag |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7n;
    }
    const field = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (wire === 0) {
      let v = 0n; shift = 0n;
      for (;;) {
        const b = data[i++];
        v |= BigInt(b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7n;
      }
      out.set(field, v);
    } else if (wire === 2) {
      let len = 0n; shift = 0n;
      for (;;) {
        const b = data[i++];
        len |= BigInt(b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7n;
      }
      out.set(field, data.slice(i, i + Number(len)));
      i += Number(len);
    } else {
      throw new Error(`grpc-web: unsupported wire type ${wire} (field ${field})`);
    }
  }
  return out;
}

const pbStr = (v: Uint8Array | bigint | undefined) =>
  v instanceof Uint8Array ? new TextDecoder().decode(v) : "";
const pbNum = (v: Uint8Array | bigint | undefined) =>
  typeof v === "bigint" ? Number(v) : 0;

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/**
 * Single grpc-web+proto unary call. Resolves with the response proto bytes
 * and rejects on transport errors or a non-zero grpc-status trailer.
 */
async function grpcWebCall(method: string, message: Uint8Array): Promise<Uint8Array> {
  const frame = new Uint8Array(5 + message.length);
  frame[0] = 0;
  new DataView(frame.buffer).setUint32(1, message.length);
  frame.set(message, 5);

  // The zec.rocks gateway serves grpc-web only over HTTP/2, and its edge
  // routes on :authority with the explicit ":443". URL.pathname is "/" for
  // a bare endpoint, so joining it blindly produced "//cash.z..." and a
  // 415 from the wrong route. Verified 11 Oct 2026.
  const endpoint = new URL(LIGHTWALLETD_ENDPOINT);
  const basePath = endpoint.pathname.replace(/\/$/, "");
  const authority = `${endpoint.hostname}:${endpoint.port || 443}`;

  const buf = await new Promise<Uint8Array>((resolve, reject) => {
    const session = http2.connect(`${endpoint.protocol}//${authority}`);
    session.on("error", reject);
    const req = session.request({
      ":method": "POST",
      ":path": `${basePath}/cash.z.wallet.sdk.rpc.CompactTxStreamer/${method}`,
      ":authority": authority,
      "content-type": "application/grpc-web+proto",
    });
    const chunks: Uint8Array[] = [];
    req.on("data", (c: Uint8Array) => chunks.push(c));
    req.on("error", reject);
    req.on("end", () => {
      session.close();
      resolve(concatBytes(chunks));
    });
    req.end(frame);
  });

  // Walk length-prefixed frames; keep the last data frame and any trailer.
  let data: Uint8Array | null = null;
  let grpcStatus = 0;
  let grpcMessage = "";
  let i = 0;
  while (i + 5 <= buf.length) {
    const flag = buf[i];
    const len = new DataView(buf.buffer, buf.byteOffset + i + 1).getUint32(0);
    const chunk = buf.slice(i + 5, i + 5 + len);
    i += 5 + len;
    if (flag & 0x80) {
      const trailer = new TextDecoder().decode(chunk);
      const m = trailer.match(/grpc-status:(\d+)/);
      if (m) grpcStatus = parseInt(m[1], 10);
      const mm = trailer.match(/grpc-message:([^\r\n]+)/);
      if (mm) grpcMessage = decodeURIComponent(mm[1].trim());
    } else {
      data = chunk;
    }
  }
  if (grpcStatus !== 0) {
    throw new Error(grpcMessage || `grpc-status ${grpcStatus}`);
  }
  return data ?? new Uint8Array(0);
}

/**
 * Runs the vendored zcash-devtool CLI (plain gRPC to the same endpoint).
 * Used for RPCs the zec.rocks grpc-web gateway refuses (GetTransaction,
 * SendTransaction). Rejects when the binary or wallet is absent.
 */
async function execDevtool(args: string[]): Promise<string> {
  const workspaceRoot = path.resolve(process.cwd(), "../..");
  const binary = path.join(
    workspaceRoot,
    "tools/zcash-devtool/target/release/zcash-devtool"
  );
  // The CLI prints its findings on stderr, so both streams are captured.
  const { stdout, stderr } = await promisify(exec)(
    `${binary} ${args.join(" ")}`,
    {
      timeout: 30_000,
      env: { ...process.env, RUST_LOG: "error" },
    }
  );
  return stdout + stderr;
}

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

const bytesToHex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

// ── lightwalletd RPCs (service.proto, walletrpc) ─────────────

/**
 * Fetches the latest block height from the lightwalletd endpoint.
 */
export async function getLatestBlockHeight(): Promise<BlockInfo> {
  // GetLatestBlock(ChainSpec) → BlockID { height = 1, hash = 2 }
  try {
    const resp = await grpcWebCall("GetLatestBlock", new Uint8Array(0));
    const fields = pbFields(resp);
    return {
      height: pbNum(fields.get(1)),
      // BlockID.hash is proto bytes; explorers quote it as hex.
      hash: bytesToHex((fields.get(2) as Uint8Array | undefined) ?? new Uint8Array(0)),
    };
  } catch (error) {
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
  // The zec.rocks grpc-web gateway serves GetTreeState.
  // GetTreeState(BlockID) → TreeState {
  //   network = 1, height = 2, hash = 3, time = 4,
  //   saplingTree = 5, orchardTree = 6, ironwoodTree = 7 }
  const resp = await grpcWebCall("GetTreeState", pbUint(1, height));
  const f = pbFields(resp);
  return {
    network: pbStr(f.get(1)) || "test",
    height: pbNum(f.get(2)) || height,
    hash: pbStr(f.get(3)),
    time: pbNum(f.get(4)),
    saplingTree: pbStr(f.get(5)),
    orchardTree: pbStr(f.get(6)),
    ironwoodTree: pbStr(f.get(7)),
  };
}

/**
 * Broadcasts a raw signed transaction to the network.
 * P1-B2: The transaction must already have its anchor bound.
 */
export async function broadcastTransaction(
  rawTxHex: string
): Promise<BroadcastResult> {
  // The zec.rocks grpc-web gateway refuses SendTransaction over grpc-web
  // (415), and plain gRPC needs a native client. The demo path for sending
  // is the vendored devtool CLI (`pczt send`), which speaks plain gRPC to
  // this endpoint. rawTxHex is validated by the route before this runs.
  void rawTxHex;
  return {
    success: false,
    error:
      "Broadcast requires the zcash-devtool CLI (pczt send). The zec.rocks grpc-web gateway refuses SendTransaction.",
  };
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
 * Queries transaction status and confirmation count from lightwalletd or indexer.
 * P1-B2: Checks whether txid is mined in a block relative to current block height.
 */
export async function getTransactionStatus(txid: string): Promise<ConfirmationStatus> {
  // zec.rocks grpc-web refuses GetTransaction (415). `inspect -l <txid>`
  // answers "Mined in testnet block N" over plain gRPC.
  try {
    const stdout = await execDevtool(["inspect", "-l", txid]);
    const minedHeight = Number(stdout.match(/block (\d+)/)?.[1]) || null;
    if (!minedHeight) return { txid, confirmed: false, confirmations: 0 };
    const latestBlock = await getLatestBlockHeight().catch(() => ({ height: 0, hash: "" }));
    const confirmations = latestBlock.height >= minedHeight ? latestBlock.height - minedHeight + 1 : 0;
    return { txid, confirmed: confirmations > 0, confirmations, blockHeight: minedHeight };
  } catch {
    return { txid, confirmed: false, confirmations: 0 };
  }
}

/**
 * Returns the configured lightwalletd endpoint.
 */
export function getEndpoint(): string {
  return LIGHTWALLETD_ENDPOINT;
}

