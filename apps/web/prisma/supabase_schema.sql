-- ──────────────────────────────────────────────────────────────
-- Quorum Fi — Supabase PostgreSQL Schema DDL
-- 
-- Run this SQL in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bxtscgxyzlbtkyymdcfx/sql/new
-- ──────────────────────────────────────────────────────────────

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "VaultStatus" AS ENUM ('PENDING_DKG', 'ACTIVE', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ZcashNetwork" AS ENUM ('TESTNET');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'BROADCASTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RoundType" AS ENUM ('COMMITMENT', 'SIGNATURE_SHARE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "RoundEventStatus" AS ENUM ('PENDING', 'RECEIVED', 'TIMEOUT', 'INVALID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ViewingKeyScope" AS ENUM ('FULL_VIEWING', 'INCOMING_VIEWING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Tables

-- Vaults Table
CREATE TABLE IF NOT EXISTS "vaults" (
    "id" TEXT PRIMARY KEY,
    "label" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "total_participants" INTEGER NOT NULL,
    "shielded_address" TEXT,
    "status" "VaultStatus" NOT NULL DEFAULT 'PENDING_DKG',
    "network" "ZcashNetwork" NOT NULL DEFAULT 'TESTNET',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Participants Table
CREATE TABLE IF NOT EXISTS "participants" (
    "id" TEXT PRIMARY KEY,
    "vault_id" TEXT NOT NULL REFERENCES "vaults"("id") ON DELETE CASCADE,
    "label" TEXT NOT NULL,
    "public_key_identifier" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Approval Requests Table
CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" TEXT PRIMARY KEY,
    "vault_id" TEXT NOT NULL REFERENCES "vaults"("id") ON DELETE CASCADE,
    "recipient_address" TEXT NOT NULL,
    "amount_zatoshi" BIGINT NOT NULL,
    "memo" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "txid" TEXT,
    "anchor_block" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3)
);

-- Signature Round Events Table
CREATE TABLE IF NOT EXISTS "signature_round_events" (
    "id" TEXT PRIMARY KEY,
    "approval_request_id" TEXT NOT NULL REFERENCES "approval_requests"("id") ON DELETE CASCADE,
    "participant_id" TEXT NOT NULL REFERENCES "participants"("id") ON DELETE CASCADE,
    "round_type" "RoundType" NOT NULL,
    "status" "RoundEventStatus" NOT NULL DEFAULT 'PENDING',
    "culprit_detected" BOOLEAN NOT NULL DEFAULT false,
    "error_code" TEXT,
    "error_details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Viewing Key Records Table
CREATE TABLE IF NOT EXISTS "viewing_key_records" (
    "id" TEXT PRIMARY KEY,
    "vault_id" TEXT NOT NULL REFERENCES "vaults"("id") ON DELETE CASCADE,
    "encrypted_viewing_key" TEXT NOT NULL,
    "scope" "ViewingKeyScope" NOT NULL DEFAULT 'FULL_VIEWING',
    "added_by" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "approval_requests_vault_id_status_idx" ON "approval_requests"("vault_id", "status");
CREATE INDEX IF NOT EXISTS "signature_round_events_approval_request_id_idx" ON "signature_round_events"("approval_request_id");
CREATE INDEX IF NOT EXISTS "signature_round_events_participant_id_idx" ON "signature_round_events"("participant_id");

-- 4. Enable Supabase Realtime (Optional for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE "vaults", "approval_requests", "signature_round_events";

-- 5. Seed Initial Demo Data (Foundation Treasury, Alice, Bob, Carol)
INSERT INTO "vaults" ("id", "label", "threshold", "total_participants", "shielded_address", "status", "network")
VALUES (
    'vault-demo-001',
    'Foundation Treasury',
    2,
    3,
    'utest1q3v4kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx9kx',
    'ACTIVE',
    'TESTNET'
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "participants" ("id", "vault_id", "label", "public_key_identifier", "is_active")
VALUES 
    ('part-alice', 'vault-demo-001', 'Alice (Treasurer)', '02a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0', true),
    ('part-bob', 'vault-demo-001', 'Bob (Director)', '02b2c3d4e5f6a10718293a4b5c6d7e8f90123456789abcdef0123456789abcdef1', true),
    ('part-carol', 'vault-demo-001', 'Carol (Auditor)', '02c3d4e5f6a1b20718293a4b5c6d7e8f90123456789abcdef0123456789abcdef2', true)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "approval_requests" ("id", "vault_id", "recipient_address", "amount_zatoshi", "memo", "status")
VALUES (
    'req-demo-001',
    'vault-demo-001',
    'utest1e8r405y4n63fyc7c2zak6jvuhjtqfjuyh7m58tdfagusj3ggeyw40dqcatd90asu6wqj5gdm9e0fz2hyzj36h62tvervzu4uvaf97ungzlcurke65y32wzr2u05n6ak5m2c2y5c9rthztrpr3yk6p24nzguts34zet3seml70856fxcrrehptfq8mqfyx0km2et8m4a72vjukmr9gg6',
    250000000, -- 2.5 ZEC
    'Grant disbursement: Q3 2026 Core Infrastructure Audit',
    'PENDING'
) ON CONFLICT ("id") DO NOTHING;
