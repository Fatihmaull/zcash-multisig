#!/usr/bin/env tsx
// ──────────────────────────────────────────────────────────────
// Quorum — Reproducible Testnet Fixture Reset
//
// P1-B3: One-command reset that prepares a clean demo state.
// Run with: pnpm fixture:reset
//
// What it does:
//   1. Resets the local PostgreSQL database (prisma db push --force-reset)
//   2. Seeds it with the Foundation Treasury vault (2-of-3)
//   3. Enrolls Alice, Bob, and Carol as participants
//   4. Creates an active PENDING approval request with the real
//      testnet recipient address
//   5. Updates the Supabase remote tables to match
//
// Why this exists:
//   You will run the demo dozens of times. Rebuilding state by hand
//   each time is a tax paid daily until 10 Oct. This script makes
//   "reset and go" a 5-second operation.
//
// See docs/10-roadmap.md P1-B3 and docs/13-phase-1-plan.md.
// ──────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const TESTNET_RECIPIENT_ADDRESS =
  "utest1e8r405y4n63fyc7c2zak6jvuhjtqfjuyh7m58tdfagusj3ggeyw40dqcatd90asu6wqj5gdm9e0fz2hyzj36h62tvervzu4uvaf97ungzlcurke65y32wzr2u05n6ak5m2c2y5c9rthztrpr3yk6p24nzguts34zet3seml70856fxcrrehptfq8mqfyx0km2et8m4a72vjukmr9gg6";

const VAULT_SHIELDED_ADDRESS =
  "utest1q3v4kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx";

async function main() {
  console.log();
  console.log("  ┌────────────────────────────────────────────┐");
  console.log("  │  Quorum — Fixture Reset (P1-B3)            │");
  console.log("  └────────────────────────────────────────────┘");
  console.log();

  // ── Step 1: Reset local database ────────────────────────────
  console.log("  [1/4] Resetting local PostgreSQL database...");

  const prisma = new PrismaClient();

  try {
    // Clear tables in dependency order
    await prisma.signatureRoundEvent.deleteMany({});
    await prisma.viewingKeyRecord.deleteMany({});
    await prisma.approvalRequest.deleteMany({});
    await prisma.participant.deleteMany({});
    await prisma.vault.deleteMany({});
    console.log("        ✓ All tables cleared");
  } catch (error) {
    console.log(
      "        ⚠ Database not available (tables may not exist yet)."
    );
    console.log(
      "          Run: pnpm --filter web exec prisma db push"
    );
    console.log(
      `          Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ── Step 2: Seed vault and participants ──────────────────────
  console.log("  [2/4] Seeding Foundation Treasury vault...");

  try {
    const vault = await prisma.vault.create({
      data: {
        id: "vault-demo-001",
        label: "Foundation Treasury",
        threshold: 2,
        totalParticipants: 3,
        shieldedAddress: VAULT_SHIELDED_ADDRESS,
        status: "ACTIVE",
        network: "TESTNET",
      },
    });
    console.log(`        ✓ Vault: ${vault.label} (${vault.id})`);

    const alice = await prisma.participant.create({
      data: {
        id: "part-alice",
        vaultId: vault.id,
        label: "Alice (Treasurer)",
        publicKeyIdentifier:
          "02a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
        isActive: true,
      },
    });

    const bob = await prisma.participant.create({
      data: {
        id: "part-bob",
        vaultId: vault.id,
        label: "Bob (Director)",
        publicKeyIdentifier:
          "02b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1",
        isActive: true,
      },
    });

    const carol = await prisma.participant.create({
      data: {
        id: "part-carol",
        vaultId: vault.id,
        label: "Carol (Auditor)",
        publicKeyIdentifier:
          "02c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2",
        isActive: true,
      },
    });

    console.log(
      `        ✓ Participants: ${alice.label}, ${bob.label}, ${carol.label}`
    );
  } catch (error) {
    console.log(
      `        ✗ Seed failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // ── Step 3: Create approval request ─────────────────────────
  console.log("  [3/4] Creating pending approval request...");

  try {
    const approval = await prisma.approvalRequest.create({
      data: {
        id: "req-demo-001",
        vaultId: "vault-demo-001",
        recipientAddress: TESTNET_RECIPIENT_ADDRESS,
        amountZatoshi: BigInt(250_000_000), // 2.5 ZEC
        memo: "Security audit fee & protocol code review",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Add Alice's pre-existing signature event
    await prisma.signatureRoundEvent.create({
      data: {
        approvalRequestId: approval.id,
        participantId: "part-alice",
        roundType: "SIGNATURE_SHARE",
        status: "RECEIVED",
      },
    });

    console.log(
      `        ✓ Approval: ${approval.id} (2.5 TAZ to recipient)`
    );
    console.log(`        ✓ Alice's signature pre-recorded`);
  } catch (error) {
    console.log(
      `        ✗ Approval creation failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  // ── Step 4: Sync to Supabase ────────────────────────────────
  console.log("  [4/4] Syncing to Supabase...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log("        ⚠ Supabase not configured, skipping remote sync.");
  } else {
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Upsert vault
      const { error: vaultErr } = await supabase.from("vaults").upsert(
        {
          id: "vault-demo-001",
          label: "Foundation Treasury",
          threshold: 2,
          total_participants: 3,
          shielded_address: VAULT_SHIELDED_ADDRESS,
          status: "ACTIVE",
          network: "TESTNET",
        },
        { onConflict: "id" }
      );
      if (vaultErr) throw vaultErr;

      // Upsert participants
      const { error: partErr } = await supabase.from("participants").upsert(
        [
          {
            id: "part-alice",
            vault_id: "vault-demo-001",
            label: "Alice (Treasurer)",
            public_key_identifier:
              "02a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0",
            is_active: true,
          },
          {
            id: "part-bob",
            vault_id: "vault-demo-001",
            label: "Bob (Director)",
            public_key_identifier:
              "02b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1",
            is_active: true,
          },
          {
            id: "part-carol",
            vault_id: "vault-demo-001",
            label: "Carol (Auditor)",
            public_key_identifier:
              "02c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2",
            is_active: true,
          },
        ],
        { onConflict: "id" }
      );
      if (partErr) throw partErr;

      // Upsert approval request
      const { error: approvalErr } = await supabase
        .from("approval_requests")
        .upsert(
          {
            id: "req-demo-001",
            vault_id: "vault-demo-001",
            recipient_address: TESTNET_RECIPIENT_ADDRESS,
            amount_zatoshi: 250000000,
            memo: "Security audit fee & protocol code review",
            status: "PENDING",
          },
          { onConflict: "id" }
        );
      if (approvalErr) throw approvalErr;

      console.log("        ✓ Supabase tables synced");
    } catch (error) {
      console.log(
        `        ✗ Supabase sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // ── Done ────────────────────────────────────────────────────
  await prisma.$disconnect();

  console.log();
  console.log("  ────────────────────────────────────────────────");
  console.log("  ✅ Fixture reset complete. Ready for demo.");
  console.log();
  console.log("  Quick check:");
  console.log("    http://localhost:3000/vaults");
  console.log("    http://localhost:3000/approvals");
  console.log("    http://localhost:3000/approvals/req-demo-001");
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
