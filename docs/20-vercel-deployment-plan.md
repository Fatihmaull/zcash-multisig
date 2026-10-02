# 20 — Vercel Deployment Plan & Operations Guide

**Created for the Quorum web application (`apps/web`).**  
This document defines the deployment architecture, configuration, step-by-step procedures, and operational runbook for deploying the Quorum web tier to [Vercel](https://vercel.com).

---

## 1. Architectural Boundaries on Vercel

Quorum is a hybrid system divided strictly across trust boundaries:
- **Rust Protocol Core & Signers (`packages/core`, `quorum-dkgd`, `quorum-signd`)**: Run exclusively on participants' local machines or HSMs. Private key shares **never** leave participant environments and **never** touch Vercel.
- **Web Tier (`apps/web`)**: Next.js 16 App Router application with React 19, Tailwind CSS v4, and Prisma ORM. This is the component deployed to Vercel Serverless / Edge infrastructure.
- **Database Layer**: Hosted PostgreSQL (e.g. Supabase, Neon, AWS RDS). Vercel Serverless Functions connect via pooled `DATABASE_URL`.
- **Zcash Network Access**: Public lightwalletd gRPC/JSON gateway (`https://testnet.zec.rocks:443`).

```
┌─────────────────────────────────────────────────────────────┐
│                       VERCEL CLOUD                          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │               apps/web (Next.js 16)                 │   │
│   │  • Landing & Docs Overview                          │   │
│   │  • Vault Management UI                              │   │
│   │  • Approval Flow & Spend Authorization UI           │   │
│   │  • Audit Trail & Viewing Key Viewer                 │   │
│   │  • API Route Handlers (/api/vaults, /api/approvals) │   │
│   └──────────┬───────────────────────────┬──────────────┘   │
└──────────────┼───────────────────────────┼──────────────────┘
               │ (Prisma Client)           │ (HTTP fetch)
               ▼                           ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│     HOSTED POSTGRESQL        │   │    PUBLIC LIGHTWALLETD    │
│   (Supabase / Neon / RDS)    │   │  https://testnet.zec.rocks│
│   • Vault metadata           │   │  • Chain metadata         │
│   • Approval states          │   │  • Ironwood tree state    │
│   • Round events             │   │  • Broadcast validation   │
│   • Encrypted viewing keys   │   └───────────────────────────┘
└──────────────────────────────┘
```

### Deployment Modes

Vercel deployment supports two operational modes:

| Mode | Coordinator Backend | `COORDINATOR_URL` | Use Case |
|---|---|---|---|
| **Mode A: Cloud Preview / Hackathon Demo** *(Recommended for Vercel)* | Built-in Mock Coordinator (`src/lib/mock-coordinator.ts`) | **Unset** | Public showcase, hackathon evaluation, UI review. Simulates DKG sessions, participant commitments, and threshold signing rounds without requiring local daemons. |
| **Mode B: Hybrid Live Coordinator** | Remote `quorum-coordinatord` instance | Set to external daemon URL (e.g., `https://coordinator.yourdomain.com`) | End-to-end multi-party signing with a hosted coordinator daemon reachable over HTTPS. |

> [!NOTE]
> In both modes, `zcash-devtool` binary execution (`src/lib/onchain-balance.ts`) gracefully degrades: when the local binary or wallet directory is absent on Vercel's serverless filesystem, balance endpoints return `null` instead of throwing, maintaining application stability.

---

## 2. Prerequisites

Before initiating deployment, ensure the following are available:

1. **Vercel Account**: Access to deploy projects via Vercel Dashboard or Vercel CLI.
2. **Hosted PostgreSQL Database**:
   - Supabase project (recommended, integrates natively with existing `src/lib/supabase.ts`), or Neon / AWS Aurora Postgres.
   - Must provide both pooled connection string (port 6543 / transaction pooler) and direct connection string (port 5432 for migrations).
3. **Repository Access**: Read access to `Fatihmaull/zcash-multisig` on GitHub.
4. **Encryption Key**: A 32-byte Base64 key for envelope-encrypting viewing keys at rest.

---

## 3. Environment Variables Reference

Configure the following environment variables in **Vercel Project Settings → Environment Variables**:

| Variable | Target Environments | Type | Description & Example |
|---|---|---|---|
| `DATABASE_URL` | Production, Preview, Dev | Sensitive | Connection string to hosted PostgreSQL. Example: `postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Production, Preview, Dev | Sensitive | Direct connection string for schema migrations (bypassing pooler). Example: `postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres` |
| `VIEWING_KEY_ENCRYPTION_KEY` | Production, Preview, Dev | Sensitive | 32-byte Base64 key for encrypting full viewing keys at rest. Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Dev | Public | URL of the Supabase project. Example: `https://[ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview, Dev | Public | Supabase public/anon API key. |
| `NEXT_PUBLIC_APP_URL` | Production, Preview, Dev | Public | Public canonical URL. Production: `https://your-domain.vercel.app` (or custom domain). Preview: dynamic `$VERCEL_URL`. |
| `NEXT_PUBLIC_ZCASH_NETWORK` | Production, Preview, Dev | Public | Must be `testnet` (Constraint C9). |
| `ZCASH_NETWORK` | Production, Preview, Dev | Public | Must be `testnet`. |
| `LIGHTWALLETD_ENDPOINT` | Production, Preview, Dev | Public | Testnet lightwalletd URL: `https://testnet.zec.rocks:443`. |
| `COORDINATOR_URL` | Production, Preview, Dev | Sensitive (Optional) | Leave **blank** for Mock Coordinator demo mode. Set only if connecting to an external live `quorum-coordinatord`. |

> [!CRITICAL]
> **Constraint C9 Reminder:** Quorum is strictly testnet-only. Do **not** set network variables to mainnet. The CI ciphersuite guard and application runtime explicitly reject mainnet designations.

---

## 4. Vercel Monorepo Configuration

Quorum uses a `pnpm` monorepo structure with workspace packages under `apps/*` and `packages/*`.

### Dashboard Project Settings

Configure these options during project import or under **Settings → General**:

- **Framework Preset**: `Next.js`
- **Root Directory**: `apps/web`
- **Include source files outside of the Root Directory**: **Checked / Enabled** (required for `pnpm-workspace.yaml`, root `node_modules`, and shared lockfiles).
- **Node.js Version**: `20.x` or `22.x` (aligned with `"engines": { "node": ">=20" }`).

### Build & Development Settings

Because Prisma Client is generated on-demand and not committed to git, the default `next build` command in `apps/web/package.json` will fail if `@prisma/client` is missing. Configure custom commands in Vercel:

| Setting | Value | Rationale |
|---|---|---|
| **Build Command** | `prisma generate && next build` | Ensures Prisma engine and client artifacts are generated before Next.js triggers typechecking and route compilation. |
| **Output Directory** | `.next` (default) | Standard Next.js build output. |
| **Install Command** | `pnpm install` (default) | Handled automatically by Vercel's pnpm 10 integration. |

---

## 5. Database Setup & Migration Runbook

Before triggering the first deployment on Vercel, the database schema must be initialized in the cloud PostgreSQL instance.

### Step 5.1 — Provision Database
1. Create a new project in [Supabase](https://supabase.com).
2. Note the database connection details:
   - Transaction Pooler URL (Port 6543) → `DATABASE_URL`
   - Direct Connection URL (Port 5432) → `DIRECT_URL`

### Step 5.2 — Apply Migrations
From your local workspace, target the remote database to deploy all Prisma migrations:

```bash
# Set remote database URL temporarily for migration deployment
export DATABASE_URL="postgresql://postgres.[ref]:[pwd]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Deploy existing schema migrations without resetting
pnpm --filter web exec prisma migrate deploy
```

### Step 5.3 — Seed Fixtures (Optional)
To pre-populate demo vaults and simulated approval requests:

```bash
pnpm --filter web exec prisma db seed
```

---

## 6. Deployment Execution

### Method 1: Deploy via Vercel Dashboard (GitHub Integration)

1. Navigate to [vercel.com/new](https://vercel.com/new).
2. Select repository: `Fatihmaull/zcash-multisig`.
3. In **Configure Project**:
   - Project Name: `quorum-multisig` (or desired name).
   - Root Directory: Click **Edit** and select `apps/web`.
   - Build Command: Override and set to `prisma generate && next build`.
4. Expand **Environment Variables** and insert all values listed in Section 3.
5. Click **Deploy**.
6. Monitor the deployment build log:
   - Verifying `pnpm install` resolution.
   - Verifying `prisma generate` creates `@prisma/client`.
   - Verifying Next.js pages and API route handlers compile.

### Method 2: Deploy via Vercel CLI

```bash
# 1. Install / ensure Vercel CLI is authenticated
pnpm dlx vercel login

# 2. Link project from repository root
pnpm dlx vercel link

# 3. Pull development environment or set production env vars
pnpm dlx vercel env add DATABASE_URL production
pnpm dlx vercel env add VIEWING_KEY_ENCRYPTION_KEY production
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_URL production
pnpm dlx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
pnpm dlx vercel env add NEXT_PUBLIC_APP_URL production

# 4. Trigger production build and deployment
pnpm dlx vercel --prod
```

---

## 7. Post-Deployment Verification & Smoke Tests

Execute these verification checks immediately following deployment:

### 1. Zcash Testnet Gateway Connectivity
Test lightwalletd endpoint reachability from Vercel Serverless:
```bash
curl -s "https://<your-vercel-domain>/api/broadcast?action=anchor" | jq .
```
**Expected Response:** JSON object containing `blockHeight` (> 4,134,000 for Ironwood), `ironwoodTree`, and timestamp.

### 2. Vault Registry & Database Health
Verify database query routing and schema availability:
```bash
curl -s "https://<your-vercel-domain>/api/vaults" | jq .
```
**Expected Response:** `200 OK` with list of registered vaults (or empty array if unseeded).

### 3. Coordinator Mock Workflow Verification
Verify that the mock coordinator operates seamlessly on serverless without local daemon processes:
1. Open `https://<your-vercel-domain>/vaults` in a browser.
2. Click **Create Vault** / Start DKG ceremony wizard.
3. Advance through participant commitment rounds and complete threshold group generation.
4. Verify vault creation persists in the database.

### 4. Spend Approval Lifecycle
1. Navigate to `/approvals` and open an active spend request.
2. Test participant approval commitment simulation.
3. Ensure status advances to `APPROVED` upon reaching threshold $t$.

---

## 8. Troubleshooting & Common Pitfalls

### Issue 1: `@prisma/client` missing during build
- **Symptom:** `Type error: Cannot find module '@prisma/client' or its corresponding type declarations`.
- **Cause:** `next build` executed before Prisma generation.
- **Fix:** In Vercel Project Settings → General → Build Command, set:
  ```bash
  prisma generate && next build
  ```

### Issue 2: Supabase Initialization Build Crash
- **Symptom:** `Error: supabaseUrl is required` or build fails during static optimization of API routes.
- **Cause:** Missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in environment variables.
- **Fix:** Ensure both variables are added to Vercel for all environments (Production, Preview, Development).

### Issue 3: Viewing Key Encryption Failure
- **Symptom:** `VIEWING_KEY_ENCRYPTION_KEY is not set` when viewing or storing audit keys.
- **Cause:** Environment variable missing or not 32 bytes base64.
- **Fix:** Generate a valid 32-byte key:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
  Add the output string to Vercel environment settings.

### Issue 4: Database Connection Pool Exhaustion
- **Symptom:** `PrismaClientInitializationError: Can't reach database server` under concurrent serverless requests.
- **Cause:** Serverless functions creating unpooled direct PostgreSQL connections.
- **Fix:** 
  1. Use Supabase Transaction Pooler URL (port 6543 with `?pgbouncer=true`).
  2. Verify `apps/web/src/lib/prisma.ts` uses the global singleton instance (already implemented).

---

## 9. Rollback & Maintenance Plan

- **Instant Rollback:** In the Vercel Dashboard under **Deployments**, locate the last healthy deployment and select **Promote to Production**. Rollbacks take < 5 seconds and require no rebuilds.
- **Database Backups:** Ensure Point-In-Time-Recovery (PITR) is active on Supabase / host provider prior to applying schema migrations.
- **Maintenance Notice:** In the event of testnet RPC degradation (`zec.rocks`), update `LIGHTWALLETD_ENDPOINT` in Vercel settings to an alternate public lightwalletd provider or self-hosted Zebra/Zaino instance.
