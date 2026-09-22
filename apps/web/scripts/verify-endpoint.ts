#!/usr/bin/env tsx
// ──────────────────────────────────────────────────────────────
// Quorum — Lightwalletd Endpoint Verification Script
//
// P1-B1: Confirms the configured testnet endpoint serves Ironwood
// data before any scanning or broadcast code is built on top of it.
//
// Usage:
//   pnpm node:verify
//   # or directly:
//   pnpm --filter web exec tsx scripts/verify-endpoint.ts
//
// Checks:
//   1. Endpoint is reachable
//   2. Block height is past Ironwood activation (4,134,000)
//   3. GetTreeState returns ironwoodTree
//   4. SendTransaction endpoint is available
//
// If any check fails, the script exits with code 1 and prints
// what to do about it.
// ──────────────────────────────────────────────────────────────

import {
  verifyEndpoint,
  getEndpoint,
  getIronwoodActivationHeight,
} from "../src/lib/zcash-node";

async function main() {
  console.log();
  console.log("  ┌─────────────────────────────────────────────┐");
  console.log("  │  Quorum — Lightwalletd Endpoint Verification │");
  console.log("  └─────────────────────────────────────────────┘");
  console.log();
  console.log(`  Endpoint:    ${getEndpoint()}`);
  console.log(`  Ironwood at: block ${getIronwoodActivationHeight().toLocaleString()}`);
  console.log();
  console.log("  Checking...");
  console.log();

  const result = await verifyEndpoint();

  // Results
  const check = (ok: boolean) => (ok ? "✅" : "❌");

  console.log(`  ${check(result.reachable)}  Reachable`);
  console.log(
    `  ${check(result.blockHeight !== null)}  Block height: ${
      result.blockHeight?.toLocaleString() ?? "unknown"
    }`
  );
  console.log(
    `  ${check(result.pastIronwoodActivation)}  Past Ironwood activation: ${
      result.blocksSinceActivation !== null
        ? `+${result.blocksSinceActivation.toLocaleString()} blocks`
        : "unknown"
    }`
  );
  console.log(
    `  ${check(result.ironwoodTreePresent)}  ironwoodTree in GetTreeState`
  );

  console.log();

  if (result.errors.length > 0) {
    console.log("  ⚠️  Errors:");
    for (const err of result.errors) {
      console.log(`     • ${err}`);
    }
    console.log();
    console.log("  The endpoint may not serve Ironwood data.");
    console.log("  Fallback: set LIGHTWALLETD_ENDPOINT=https://testnet.zec.rocks:443");
    console.log("  Or start the self-hosted Z3 stack: docker compose up zebra zaino");
    console.log();
    process.exit(1);
  }

  console.log("  ✅  All checks passed. Endpoint is ready for Phase 1.");
  console.log();
}

main().catch((err) => {
  console.error("  Fatal:", err);
  process.exit(1);
});
