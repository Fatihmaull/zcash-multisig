// Minimal e2e seed: 2-of-3 ACTIVE vault, 3 participants, 1 pending approval.
// Run: DATABASE_URL="file:/tmp/quorum-e2e/dev.db" tsx scripts/seed-e2e.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

await prisma.signatureRoundEvent.deleteMany();
await prisma.viewingKeyRecord.deleteMany();
await prisma.approvalRequest.deleteMany();
await prisma.participant.deleteMany();
await prisma.vault.deleteMany();

const vault = await prisma.vault.create({
  data: {
    label: "E2E Treasury",
    threshold: 2,
    totalParticipants: 3,
    status: "ACTIVE",
    network: "TESTNET",
    shieldedAddress: "ztestsapling1qqe2evaultplaceholder",
  },
});

for (const label of ["Alice", "Bob", "Carol"]) {
  await prisma.participant.create({
    data: { vaultId: vault.id, label, isActive: true },
  });
}

const req = await prisma.approvalRequest.create({
  data: {
    vaultId: vault.id,
    recipientAddress: "ztestsapling1qqe2erecipientplaceholder",
    amountZatoshi: 150000000n,
    status: "PENDING",
    memo: "e2e flow",
  },
});

console.log(JSON.stringify({ vaultId: vault.id, approvalId: req.id }));
await prisma.$disconnect();
