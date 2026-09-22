# Quorum

**Shared custody for Zcash shielded funds (Private Multisig).**

Language: **English** | [Bahasa Indonesia](README.id.md)

Zcash shielded pools have no multisig opcode. An organisation holding ZEC today must either use a
transparent address — losing the entire reason to use Zcash — or let one person hold the seed.
Quorum is the organisational layer over re-randomized FROST that makes threshold control of
shielded funds usable by a treasurer on a Monday morning.

> **We are not building cryptography.** `frost-core` v3.0.0 is audited and stable. The
> transport (`frostd`) exists. The gap is everything between the library and an organisation
> that has to pass a controls audit. That is what we build, and that is why 26 days is realistic.

---

## Quickstart & System Usage Guide

### 1. How Quorum Works (The Mental Model)
- **Zero Custody:** The coordinator server never sees or stores key shares.
- **FROST Threshold Scheme (2-of-3):** 3 participants (Alice, Bob, Carol) hold device-isolated key shares. Any transfer requires consensus from at least 2 signers.
- **Viewing-Key Audit Trail:** Transactions are verified on-chain via Zcash Viewing Keys, providing cryptographically verifiable reports for auditors without granting spending authority.

### 2. Running the Application Locally

```bash
# 1. Start the local PostgreSQL service
docker compose up -d postgres

# 2. Run Prisma database migrations & seed demo state
pnpm db:deploy
pnpm db:seed
# Or reset everything in one command:
# pnpm fixture:reset

# 3. Start the Next.js development server
pnpm dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 3. Exploring the System via Web UI
- **Dashboard (`/`):** View your 2-of-3 threshold vault metrics and active spend proposals.
- **Pending Approvals (`/approvals` & `/approvals/req-demo-001`):**
  - View the proposal requiring 2-of-3 consensus (Alice has already approved).
  - Click **"Sign as Bob"** to collect the 2nd signature and observe the shielded transaction broadcast to Zcash Testnet.
- **Interactive Edge-Case Sandbox (Bottom-Right Panel):**
  - **Normal Flow:** 2 signers collaborate smoothly.
  - **Bob Offline / Timeout:** Demonstrates switching to **Carol (Standby Signer)** when Bob is unavailable.
  - **Corrupt Share (F4 Culprit Detection):** Demonstrates automatic rejection and mathematical identification of a compromised device without risking treasury funds.
- **Key Ceremony Simulation (`/vaults/.../ceremony`):** Step through the distributed key generation (DKG) process.

---

## Status

| | |
|---|---|
| **Phase** | Pre-development — documentation complete, no application code yet |
| **Next action** | Spike S1, tasks P0-A1–A5 (see [docs/10-roadmap.md](docs/10-roadmap.md)) — get `frost-zcash-demo` running with RedPallas |
| **Hackathon** | Colosseum Crypto World's Fair, Zcash track |
| **Window** | 14 Sep – 12 Oct 2026 |
| **Days remaining** | 24 to target submission (as of 17 Sep 2026) |
| **Target** | Top 10 of the Zcash track ($10,000). General pool is a lottery ticket, not a plan. |
| **Network** | **Testnet only. No mainnet funds, ever, during this build.** |

---

## Read in this order

| Doc | What it settles |
|---|---|
| [00-plain-english.md](docs/00-plain-english.md) | The project explained without jargon — the public-facing overview |
| [01-strategy.md](docs/01-strategy.md) | Why the Zcash track, how we're positioned, how we score against each judging criterion |
| [02-product-spec.md](docs/02-product-spec.md) | The problem, the flows we build, and the hard scope boundary |
| [03-architecture.md](docs/03-architecture.md) | Components, trust boundaries, what never touches our server |
| [04-technical-constraints.md](docs/04-technical-constraints.md) | Non-negotiable technical facts, verified Sept 2026, with failure modes |
| [05-plan.md](docs/05-plan.md) | The five hard gates and the reasoning behind them |
| [10-roadmap.md](docs/10-roadmap.md) | **Every task, estimated, assigned to a developer, with dependencies** |
| [06-risk-register.md](docs/06-risk-register.md) | What kills this project and what we do instead |
| [07-demo-script.md](docs/07-demo-script.md) | The three-minute video, beat by beat |
| [08-prior-art.md](docs/08-prior-art.md) | Exact crates and repos — what to build on, what never to rebuild |
| [09-traction.md](docs/09-traction.md) | The one judging criterion we cannot earn by coding |
| [13-phase-1-plan.md](docs/13-phase-1-plan.md) | **Phase 1 execution plan — day by day to Gate B** |
| [12-spike-s1-report.md](docs/12-spike-s1-report.md) | **Spike S1 findings — what actually works, what was broken, what is still open** |
| [11-contract-review.md](docs/11-contract-review.md) | Open questions on the coordinator contract — resolve before 22 Sep, then delete |

[CLAUDE.md](CLAUDE.md) is the persistent context for Claude Code sessions. It is loaded
automatically; you do not need to paste a brief.

---

## The three things that kill this project

1. **Targeting the wrong pool.** Orchard went exit-only on 28 July 2026. A demo that spends
   from Orchard is demoing a deprecated pool in front of the community that deprecated it.
   **We target Ironwood.** See [04-technical-constraints.md](docs/04-technical-constraints.md).

2. **The happy path never lands.** PCZT v2 + Ironwood support sits on release candidates with
   open upstream issues. If a 2-of-3 shielded spend does not confirm on testnet by **27 Sept**,
   we switch to the degraded demo defined in [06-risk-register.md](docs/06-risk-register.md).
   Everything else is decoration.

3. **The demo is rushed.** Hackathon projects lose because the video was recorded at 2am on
   deadline day, not because the code was bad. **Feature freeze 4 Oct. Recording starts 5 Oct.
   Submit 10 Oct**, two days early.

---

## Security posture — read before writing any claim

`frost-core` is audited by NCC Group. **`frost-rerandomized` is not covered by that audit** and
its documentation still carries an API-may-change warning. ZIP-312 is still a Draft.

Never describe this project as audited, production-ready, or safe for mainnet funds. Overstating
the security posture of a custody product is the worst failure mode available to us — worse than
missing the deadline. When unsure whether something is audited, write that we are unsure.
