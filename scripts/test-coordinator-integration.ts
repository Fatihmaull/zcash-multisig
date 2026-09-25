// ──────────────────────────────────────────────────────────────
// Verification script: P3-B1 Coordinator Integration Test
//
// Tests:
// 1. Spawns quorum-coordinatord on test port 2746.
// 2. Points COORDINATOR_URL to http://127.0.0.1:2746.
// 3. Tests health endpoint (/health).
// 4. Registers a vault via /coordinator/vault/register.
// 5. Lists vaults via /coordinator/vault/list.
// 6. Submits an approval via /coordinator/approval/submit.
// 7. Queries approval status via /coordinator/approval/status.
// 8. Audits vault via /coordinator/vault/audit.
// 9. Asserts all calls succeed with 200 OK and no 404s.
// ──────────────────────────────────────────────────────────────

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { DEFAULT_UNSIGNED_PCZT_HEX } from "../apps/web/src/lib/fixtures/pczt";
import { writeFileSync, readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 2746;
const HOST = "127.0.0.1";
const URL = `http://${HOST}:${PORT}`;
const BINARY = resolve(__dirname, "../packages/core/target/debug/quorum-coordinatord");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const FIXTURE_DIR = resolve(__dirname, "../packages/core/fixtures/vault-3p");
const CARGO_TOML = resolve(__dirname, "../packages/core/Cargo.toml");

function cargoRun(args: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
  execFileSync("cargo", ["run", "--quiet", "--manifest-path", CARGO_TOML, ...args], {
    stdio: "inherit",
  });
}

/**
 * Make the fixture transaction belong to the fixture vault.
 *
 * The coordinator refuses a PCZT whose `rk` is not this vault's `ak`
 * randomized by the action's own `alpha` — a vault that skips this check
 * will produce a perfectly valid FROST signature over somebody else's
 * transaction and report a quorum. So the fixture PCZT, which was captured
 * from a different vault, has to be rebound to whichever throwaway vault
 * this run generated.
 *
 * The alternative would be committing the original vault's key shares, and
 * we are not doing that. `rk` is public and so is `alpha`, so the rebind
 * needs no secret. The result is unbroadcastable — the proof still commits
 * to the old key — which is exactly right for a contract test.
 */
function bindPcztToFixtureVault(): string {
  const out = join(mkdtempSync(join(tmpdir(), "quorum-pczt-")), "bound.hex");
  const input = join(mkdtempSync(join(tmpdir(), "quorum-pczt-in-")), "fixture.hex");
  writeFileSync(input, DEFAULT_UNSIGNED_PCZT_HEX.trim());
  cargoRun(["-p", "quorum-coordinator", "--example", "bind_pczt", "--", input, FIXTURE_DIR, out]);
  return readFileSync(out, "utf8").trim();
}

/**
 * Produce a throwaway vault for this test, generating it if it is not there.
 *
 * It used to be committed. That put three sealed key shares and the vault
 * seed in a public repository, and the passphrase that opens the shares is a
 * constant in `examples/ceremony.rs` — so they were shares in name only.
 * Testnet, so nothing was lost, but a shared-custody product does not ship
 * key material in its repository, and a reviewer who finds some will not
 * stop to check which network it was for.
 *
 * `packages/core/fixtures/` is gitignored now. The vault this makes is
 * disposable: never fund it, and never reuse it for anything that matters.
 */
async function ensureFixtureVault(): Promise<string> {
  if (existsSync(resolve(FIXTURE_DIR, "public-key-package.json"))) {
    return FIXTURE_DIR;
  }

  console.log("Generating a throwaway fixture vault (not committed)...");
  cargoRun(["-p", "quorum-signer", "--example", "ceremony", "--", FIXTURE_DIR]);
  return FIXTURE_DIR;
}

async function main() {
  console.log("=== Testing P3-B1 Live Coordinator Client Integration ===");
  console.log(`Starting quorum-coordinatord on ${URL}...`);

  const proc = spawn(BINARY, [], {
    env: {
      ...process.env,
      QUORUM_COORDINATOR_ADDR: `${HOST}:${PORT}`,
    },
    stdio: "pipe",
  });

  proc.on("error", (err) => {
    console.error("Failed to start coordinatord:", err);
    process.exit(1);
  });

  // Wait for health check
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${URL}/health`, { method: "POST" });
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // wait
    }
    await sleep(200);
  }

  if (!ready) {
    console.error("Coordinatord failed to become healthy");
    proc.kill();
    process.exit(1);
  }
  console.log("✓ Live coordinator is healthy on /health");

  try {
    // Set COORDINATOR_URL
    process.env.COORDINATOR_URL = URL;
    const { coordinatorClient } = await import("../apps/web/src/lib/coordinator-client");

    // 1. Health check via client
    const health = await coordinatorClient.checkHealth();
    console.log("✓ coordinatorClient.checkHealth():", health);

    const fixtureDir = await ensureFixtureVault();
    const { readFileSync } = await import("node:fs");
    const pubKeyPkg = JSON.parse(readFileSync(resolve(fixtureDir, "public-key-package.json"), "utf8"));
    const participants = JSON.parse(readFileSync(resolve(fixtureDir, "participants.json"), "utf8"));
    const address = readFileSync(resolve(fixtureDir, "vault-address.txt"), "utf8").trim();
    const vaultSeedHex = readFileSync(resolve(fixtureDir, "vault-seed.hex"), "utf8").trim();

    // 2. Register Vault via /coordinator/vault/register
    const regResult = await coordinatorClient.registerVault({
      label: "Integration Test Vault",
      threshold: 2,
      address,
      publicKeyPackage: pubKeyPkg,
      participants,
    });
    console.log("✓ Vault registered successfully:", regResult.vaultId);
    console.log("  Participant tokens minted:", regResult.participantTokens.length);

    // 3. List vaults via /coordinator/vault/list
    const vaults = await coordinatorClient.listVaults();
    console.log("✓ coordinatorClient.listVaults(): count =", vaults.length);
    if (vaults.length === 0 || vaults[0].id !== regResult.vaultId) {
      throw new Error("Vault list did not contain registered vault");
    }

    // 4. Submit approval request via /coordinator/approval/submit
    const boundPcztHex = bindPcztToFixtureVault();
    const approval = await coordinatorClient.submitApproval({
      vaultId: regResult.vaultId,
      recipientAddress: "utest1recipient",
      amountZatoshi: 1000000n,
      memo: "P3-B1 verification transfer",
      pcztHex: boundPcztHex,
      signerDeadlineSecs: 120,
    });
    console.log("✓ Approval submitted successfully on /coordinator/approval/submit. ID:", approval.id);
    console.log("  Status:", approval.status, "| Threshold:", approval.threshold);

    // 4b. The same transaction, unbound, must be refused.
    //
    // Worth asserting rather than assuming: a submit path that accepted
    // anything would pass every other check in this file, and the failure
    // would only surface as a node rejecting a broadcast.
    try {
      await coordinatorClient.submitApproval({
        vaultId: regResult.vaultId,
        recipientAddress: "utest1recipient",
        amountZatoshi: 1000000n,
        pcztHex: DEFAULT_UNSIGNED_PCZT_HEX,
        signerDeadlineSecs: 120,
      });
      throw new Error(
        "the coordinator accepted a PCZT built by another vault — the binding check is not running",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("different vault")) throw e;
      console.log("✓ A PCZT from another vault is refused at submission");
    }

    // 5. Get approval status via /coordinator/approval/status
    const status = await coordinatorClient.getApprovalStatus(approval.id);
    console.log("✓ Approval status retrieved on /coordinator/approval/status:");
    console.log("  Status:", status.status, "| Signatures collected:", status.signaturesCollected);
    console.log("  Signer statuses:", status.signerStatuses.map((s: any) => `${s.participantLabel}:${s.status}`).join(", "));

    // 6. Test Vault Audit via /coordinator/vault/audit
    const auditRes = await coordinatorClient.auditVault({
      vaultId: regResult.vaultId,
      vaultSeedHex,
    });
    console.log("✓ Vault audit retrieved on /coordinator/vault/audit:");
    console.log("  UFVK:", auditRes.unifiedFullViewingKey.substring(0, 30) + "...");
    console.log("  Shielded address matches:", auditRes.shieldedAddress === address);

    console.log("\n🎉 ALL P3-B1 COORDINATOR CONTRACT CHECKS PASSED WITH NO 404s!");
  } finally {
    proc.kill();
  }
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
