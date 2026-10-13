/**
 * Demo UI seed for video beats 1/2/6. Runs only on the Mac.
 * - Real ceremony vault address (public)
 * - Approval amount matches filmed spend claim (0.01 TAZ)
 * - Viewing key encrypted from local ceremony-watch DB; never printed
 * - No fabricated live balances in rows the UI would show as chain readings
 */
import { PrismaClient } from "@prisma/client";
import { encryptViewingKey } from "../src/lib/viewing-key-crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const prisma = new PrismaClient();

const ROOT = path.resolve(__dirname, "../../..");
const ADDR = readFileSync(
  path.join(ROOT, "secrets/ceremony/vault-address.txt"),
  "utf8",
).trim();

function loadUfvk(): string {
  // Read UFVK from local ceremony-watch sqlite without echoing it.
  const db = path.join(ROOT, "secrets/ceremony-watch/data.sqlite");
  const out = execSync(
    `sqlite3 "${db}" "SELECT ufvk FROM accounts WHERE name='ceremony-vault' LIMIT 1;"`,
    { encoding: "utf8" },
  ).trim();
  if (!out || out.length < 80) {
    throw new Error("UFVK missing from ceremony-watch DB");
  }
  return out;
}

async function main() {
  console.log("Seeding demo UI DB…");
  console.log("  vault address prefix:", ADDR.slice(0, 18) + "…");

  await prisma.signatureRoundEvent.deleteMany();
  await prisma.viewingKeyRecord.deleteMany();
  await prisma.approvalRequest.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.vault.deleteMany();

  const vault = await prisma.vault.create({
    data: {
      label: "Foundation Treasury",
      threshold: 2,
      totalParticipants: 3,
      shieldedAddress: ADDR,
      status: "ACTIVE",
      network: "TESTNET",
    },
  });

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

  // Completed approval matching filmed beat-4 spend claim (on-screen-numbers.md)
  const completed = await prisma.approvalRequest.create({
    data: {
      vaultId: vault.id,
      recipientAddress:
        "utest1e8r405y4n63fyc7c2zak6jvuhjtqfjuyh7m58tdfagusj3ggeyw40dqcatd90asu6wqj5gdm9e0fz2hyzj36h62tvervzu4uvaf97ungzlcurke65y32wzr2u05n6ak5m2c2y5c9rthztrpr3yk6p24nzguts34zet3seml70856fxcrrehptfq8mqfyx0km2et8m4a72vjukmr9gg6",
      amountZatoshi: BigInt(1_000_000), // 0.01000000 TAZ — filmed claim
      memo: "Demo spend — ceremony vault (testnet)",
      status: "BROADCASTED",
      txid: "0f281befb6b49e53ab7bec992289095cd6695455c5997ddb4b02f9eae9e36b03",
      anchorBlock: 4426231,
    },
  });

  await prisma.signatureRoundEvent.createMany({
    data: [
      {
        approvalRequestId: completed.id,
        participantId: alice.id,
        roundType: "COMMITMENT",
        status: "RECEIVED",
        culpritDetected: false,
      },
      {
        approvalRequestId: completed.id,
        participantId: bob.id,
        roundType: "COMMITMENT",
        status: "RECEIVED",
        culpritDetected: false,
      },
      {
        approvalRequestId: completed.id,
        participantId: alice.id,
        roundType: "SIGNATURE_SHARE",
        status: "RECEIVED",
        culpritDetected: false,
      },
      {
        approvalRequestId: completed.id,
        participantId: bob.id,
        roundType: "SIGNATURE_SHARE",
        status: "RECEIVED",
        culpritDetected: false,
      },
    ],
  });

  const ufvk = loadUfvk();
  const enc = encryptViewingKey(ufvk);
  await prisma.viewingKeyRecord.create({
    data: {
      vaultId: vault.id,
      encryptedViewingKey: enc,
      scope: "FULL_VIEWING",
      addedBy: "Alice (Treasurer)",
    },
  });

  // Sanity: truncated form only (what audit export shows)
  const trunc = `${ufvk.slice(0, 16)}…${ufvk.slice(-8)}`;
  console.log("  vault id:", vault.id);
  console.log("  participants: Alice, Bob, Carol");
  console.log("  approval:", completed.id, "0.01000000 TAZ BROADCAST txid 0f281bef…");
  console.log("  truncated viewing key (export-safe):", trunc);
  console.log("  network: TESTNET");
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
