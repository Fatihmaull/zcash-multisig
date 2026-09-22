-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VaultStatus" AS ENUM ('PENDING_DKG', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ZcashNetwork" AS ENUM ('TESTNET');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'BROADCASTED');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('COMMITMENT', 'SIGNATURE_SHARE');

-- CreateEnum
CREATE TYPE "RoundEventStatus" AS ENUM ('PENDING', 'RECEIVED', 'TIMEOUT', 'INVALID');

-- CreateEnum
CREATE TYPE "ViewingKeyScope" AS ENUM ('FULL_VIEWING', 'INCOMING_VIEWING');

-- CreateTable
CREATE TABLE "vaults" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "total_participants" INTEGER NOT NULL,
    "shielded_address" TEXT,
    "status" "VaultStatus" NOT NULL DEFAULT 'PENDING_DKG',
    "network" "ZcashNetwork" NOT NULL DEFAULT 'TESTNET',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "public_key_identifier" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "recipient_address" TEXT NOT NULL,
    "amount_zatoshi" BIGINT NOT NULL,
    "memo" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "txid" TEXT,
    "anchor_block" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signature_round_events" (
    "id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "round_type" "RoundType" NOT NULL,
    "status" "RoundEventStatus" NOT NULL DEFAULT 'PENDING',
    "culprit_detected" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "error_details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_round_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "viewing_key_records" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "encrypted_viewing_key" TEXT NOT NULL,
    "scope" "ViewingKeyScope" NOT NULL DEFAULT 'FULL_VIEWING',
    "added_by" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viewing_key_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_requests_vault_id_status_idx" ON "approval_requests"("vault_id", "status");

-- CreateIndex
CREATE INDEX "signature_round_events_approval_request_id_idx" ON "signature_round_events"("approval_request_id");

-- CreateIndex
CREATE INDEX "signature_round_events_participant_id_idx" ON "signature_round_events"("participant_id");

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_round_events" ADD CONSTRAINT "signature_round_events_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_round_events" ADD CONSTRAINT "signature_round_events_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viewing_key_records" ADD CONSTRAINT "viewing_key_records_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

