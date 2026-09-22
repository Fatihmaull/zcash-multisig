// ──────────────────────────────────────────────────────────────
// Quorum — Database Seed Script
//
// Seeds a demo 2-of-3 vault with 3 participants and a sample
// approval request for fixture testing.
//
// Run: npx prisma db seed
// ──────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import { encryptViewingKey } from "../src/lib/viewing-key-crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Quorum database...\n");

  // ── Clean existing data ───────────────────────────────────
  await prisma.signatureRoundEvent.deleteMany();
  await prisma.viewingKeyRecord.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.vault.deleteMany();

  // ── Create demo vault ─────────────────────────────────────
  const vault = await prisma.vault.create({
    data: {
      label: "Foundation Treasury",
      threshold: 2,
      totalParticipants: 3,
      shieldedAddress:
        "utest1q3v4kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx",
      status: "ACTIVE",
      network: "TESTNET",
    },
  });
  console.log(`  ✓ Vault: "${vault.label}" (${vault.id})`);

  // ── Create 3 participants ─────────────────────────────────
  const alice = await prisma.participant.create({
    data: {
      vaultId: vault.id,
      label: "Alice (Treasurer)",
      publicKeyIdentifier:
        "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90",
      isActive: true,
    },
  });

  const bob = await prisma.participant.create({
    data: {
      vaultId: vault.id,
      label: "Bob (Director)",
      publicKeyIdentifier:
        "b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1",
      isActive: true,
    },
  });

  const carol = await prisma.participant.create({
    data: {
      vaultId: vault.id,
      label: "Carol (Auditor)",
      publicKeyIdentifier:
        "c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2",
      isActive: true,
    },
  });

  console.log(`  ✓ Participants: ${alice.label}, ${bob.label}, ${carol.label}`);

  // ── Create a sample approval request ──────────────────────
  const approval = await prisma.approvalRequest.create({
    data: {
      vaultId: vault.id,
      recipientAddress:
        "utest1e8r405y4n63fyc7c2zak6jvuhjtqfjuyh7m58tdfagusj3ggeyw40dqcatd90asu6wqj5gdm9e0fz2hyzj36h62tvervzu4uvaf97ungzlcurke65y32wzr2u05n6ak5m2c2y5c9rthztrpr3yk6p24nzguts34zet3seml70856fxcrrehptfq8mqfyx0km2et8m4a72vjukmr9gg6",
      amountZatoshi: BigInt(250_000_000), // 2.5 ZEC
      memo: "Q3 grant disbursement to ZecHub",
      status: "PENDING",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  console.log(
    `  ✓ Approval Request: ${approval.id} (2.5 ZEC to grant recipient)`
  );

  // ── Create signing round events ───────────────────────────
  // Alice has submitted her commitment
  await prisma.signatureRoundEvent.create({
    data: {
      approvalRequestId: approval.id,
      participantId: alice.id,
      roundType: "COMMITMENT",
      status: "RECEIVED",
      culpritDetected: false,
    },
  });

  // Alice has submitted her signature share
  await prisma.signatureRoundEvent.create({
    data: {
      approvalRequestId: approval.id,
      participantId: alice.id,
      roundType: "SIGNATURE_SHARE",
      status: "RECEIVED",
      culpritDetected: false,
    },
  });

  // Bob's commitment is pending
  await prisma.signatureRoundEvent.create({
    data: {
      approvalRequestId: approval.id,
      participantId: bob.id,
      roundType: "COMMITMENT",
      status: "PENDING",
      culpritDetected: false,
    },
  });

  console.log("  ✓ Signature round events seeded");

  // ── Create a viewing key record (opt-in) ──────────────────
  await prisma.viewingKeyRecord.create({
    data: {
      vaultId: vault.id,
      // Deliberately not a plausible-looking key. A realistic-looking
      // string in seed data eventually gets mistaken for a real one.
      // Sapling-format placeholders were also wrong here: this build
      // targets the Ironwood pool (constraint C1).
      encryptedViewingKey: encryptViewingKey(
        "PLACEHOLDER-NOT-A-REAL-VIEWING-KEY-seed-data-only",
      ),
      scope: "FULL_VIEWING",
      addedBy: "Alice (Treasurer)",
    },
  });
  console.log("  ✓ Viewing key record seeded (opt-in)\n");

  console.log("🌱 Seed complete.\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
