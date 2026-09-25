# Quorum — persistent context for Claude Code

Read this before writing code. It carries the reasoning behind the decisions, not just the
spec, so that you can push back when a proposed change contradicts the reasoning instead of
silently going along with it.

Full detail lives in [docs/](docs/). This file is the part you must never lose.

---

## What we are building

**Quorum** — shared custody / threshold signing for **Zcash shielded funds**, for the Colosseum
Crypto World's Fair hackathon (Zcash track, submission deadline **12 October 2026**).

An orchestration layer over re-randomized FROST: guided key ceremony, signer coordination,
cryptographically enforced quorum, misbehaving-signer handling, and a viewing-key-backed audit
trail.

**Positioning — hold this line.** Not the cryptography (exists, audited by others). Not the
transport (exists). Not "FROST tooling for Zcash" — that is the Zcash Foundation's lane and we
lose that fight. We build the **organisational governance layer** in between.

**Non-custodial by design.** Key shares never touch our server. This is a product decision and
a legal one.

---

## Working agreement

- **Challenge this brief when it is wrong.** If something here is outdated or there is a better
  approach, say so directly with reasoning. Do not quietly deviate, and do not agree just
  because it is written down. This document has already been wrong once — see the Ironwood
  correction below.
- **Verify time-sensitive facts.** Everything here was verified 15–16 September 2026. Library
  versions, ZIP-312 status, and NU7 timing move. Check before relying on any of it.
- **Never invent security claims.** If unsure whether something is audited or safe, say so.
  Overstating the security posture of a custody product is the worst possible failure mode.
- **Flag scope creep immediately.** No extension exists. If a feature threatens the end-to-end
  demo, say so before building it.
- **Explain the cryptographic reasoning, not the Rust.** Rust fluency is no longer the
  constraint (updated 20 Sep) — work at full speed and skip the language hand-holding. What
  still needs spelling out is the *protocol*: why a randomizer comes from the transaction, why
  a nonce must never be reused, what a given API actually guarantees. The team also brings a
  security-audit and GRC background, so precision about trust boundaries lands and is worth
  the words.
- **Guard the demo deadline.** If recording has not started by **5 October**, say so
  unprompted, every session.

---

## Non-negotiable technical facts

Verified 15–16 September 2026. Rationale and failure modes in
[docs/04-technical-constraints.md](docs/04-technical-constraints.md).

1. **Target the Ironwood pool, not Orchard.** Ironwood (formally **NU6.3**, *not* NU7) activated
   on mainnet 28 July 2026 at block 3,428,143, replacing Orchard after a counterfeit-ZEC bug.
   **Orchard is exit-only** — it accepts no new shielded activity. Demoing an Orchard spend
   signals we researched a month ago and stopped reading.
2. **NU7 is a separate, later upgrade that has not happened.** Coinholder voting opened
   25 August 2026. Do not build against NU7 behaviour and do not lead with post-NU7 lockbox
   distribution as a user story.
3. **Use the RedPallas ciphersuite, never the Ed25519 default.** Pass `-C redpallas` to every
   `frost-zcash-demo` binary. RedPallas is what makes signatures Zcash-compatible and
   automatically switches to rerandomized FROST. RedPallas survives into Ironwood: ZIP-2005
   changed *note construction* for quantum recoverability, **not** the spend-authorization
   signature scheme.
4. **DKG requires authenticated AND confidential channels.** Signing requires only authenticated
   channels. Getting this wrong permits man-in-the-middle during key generation and breaks
   everything downstream. First-class architectural requirement, never a TODO.
5. **Target FROST v3.x** (`frost-core` v3.0.0 released). The rerandomized API was reworked so all
   signing parties contribute randomness; `InvalidSignatureShare::culprit` became `culprits`
   (a vector). Read the changelog before pinning.
6. **We are pinned to release candidates** (`pczt 0.8.0-rc.1`, `zcash_client_backend
   0.24.0-rc.1`). **Final releases now exist** — `zcash-devtool` uses `pczt 0.9.1` and
   `zcash_client_backend 0.24.0`. Moving off an rc onto its final is not the "chasing upstream"
   this constraint forbids, but make it a deliberate decision — ideally after Gate B, unless
   P1-A4 needs something only 0.9.1 has. Pin exact versions and commit `Cargo.lock` either way.
7. **ZIP-312 is still Draft.** The Zcash Foundation's 2026 roadmap says it is being finalised.
   Flag anywhere our design depends on draft behaviour.
8. **Build on the Z3 stack** (Zebra, Zaino, Zallet). `zcashd` is retired.
9. **Testnet only. No mainnet funds, ever, during this build.**
10. **The vault seed is persisted, and it is a shared secret.** `ak` comes from FROST; `nk` and
    `rivk` come from a `VaultSeed` generated once at the ceremony. Redraw it and every
    derivation yields a different address — that stranded 0.05 TAZ on 22 Sep. **Never derive
    it from the group key**: `ak` is in the address, so anyone holding the address could
    rebuild the viewing key and read the vault's entire history. See
    `quorum-core/src/vault_key.rs`.

---

## The insight we lead with

In the **v6 transaction format, the shielded anchor is authorizing data** — it can be chosen
*after* signatures are collected, at broadcast time.

This matters enormously for threshold signing. Signer 1 approves at 09:00; signer 2 opens their
laptop at 16:00. Under the older format the anchor chosen at build time goes stale, the
transaction must be rebuilt, and every signature already collected is discarded. v6 removes that
failure mode.

That is the concrete technical reason why a *usable* shielded multisig is possible now and was
not a year ago. It is our strongest "why now", and it is specific enough that a Zcash-track
judge will recognise we actually read the spec. Use it.

---

## Scope boundary

**In scope** — one flow, end to end:
2-of-3 key ceremony via DKG with a UI a non-cryptographer can complete · creating an approval
request for a shielded transaction · signer coordination including a non-responding signer ·
misbehaving-signer detection surfaced as a human-readable event · signature aggregation,
broadcast, confirmation · **viewing-key-backed** audit trail export.

**Out of scope — do not build, and say so if the user drifts toward these:**
wallet features (portfolio, balances, prices, quick send) · multi-chain anything · tiered or
dynamic quorum policies · hardware wallet integration · mainnet support · signer rotation and
share repair (the libraries support them; we are not surfacing them in this build).

**Priority order for retiring risk** — this is deliberately *not* the same as the order of
importance:

1. A real 2-of-3 shielded **Ironwood** spend confirming on testnet. Hardest, most likely to
   fail, and without it there is no demo at all.
2. Misbehaving-signer detection. This is the feature that *wins* the track, because it shows we
   understand what actually goes wrong when shared control fails — but mechanically it is
   surfacing `InvalidSignatureShare::culprits` in good UI, so it is not where the engineering
   risk lives. Build it second, feature it second in the video.
3. Everything else.

---

## Calendar and gates

| Date | Gate |
|---|---|
| 21 Sep | ✅ **A** (passed) — `frost-zcash-demo` running with RedPallas, coordinator + 2 participants. Verdict on PCZT v2 + Ironwood. |
| 27 Sep | ✅ **B** (passed 23 Sep) — 2-of-3 shielded Ironwood spend confirmed on testnet, txid `0ef1e964…2681ce`, block 4,383,363. One criterion still open: DKG across three processes (P3-A6). |
| 4 Oct | **C** — end to end through the web UI. **Feature freeze.** |
| 5 Oct | **D** — demo recording begins. |
| 10 Oct | **E** — submit, two days early. |

Missing Gate B triggers the degraded demo in [docs/06-risk-register.md](docs/06-risk-register.md).
It is a decision point, not a reason to push harder on the same path.

---

## Phase 1 starts 22 Sep

Execution plan: [docs/13-phase-1-plan.md](docs/13-phase-1-plan.md). Three things in it override
intuition and will cost a day each if missed:

- **The randomizer comes from the PCZT, per action** — `action.spend().alpha()`. The v3
  guidance to use `RandomizedParams::new_from_commitments()` is for generic FROST and does
  **not** apply to Zcash. Use `RandomizedParams::from_randomizer()`. Leave a comment saying why,
  or someone will "fix" it and silently break spend authorization.
- **One FROST signing round per spend action**, all over the same sighash. The coordinator's
  unit of work is an action, not a transaction.
- **A v6 transaction has two shielded bundles** (Orchard and Ironwood) and asking the wrong one
  yields zero spends rather than an error. Track `(pool, index, alpha)` and treat an empty
  result as a failure.

## Current phase — Phase 3, 25 Sep

**Gate B passed 23 Sep, four days early.** A 2-of-3 threshold-signed shielded **Ironwood** spend
is confirmed on testnet — txid
`0ef1e96411b770fb0aec7d35c820510cd303f696126ac85782158c75382681ce`, block 4,383,363. Quote this
txid in the submission; it is the single hardest thing to fake and the easiest for a judge to
check.

**Signing is distributed. Key generation is not — yet.** `./scripts/three-signer-demo.sh` starts
`quorum-coordinatord` plus three `quorum-signerd` processes, one sealed share each, and the
coordinator holds none. But those shares were born in one process
(`cargo run -p quorum-signer --example ceremony`). So:

- *No party sees more than one share while signing* — **demonstrated.**
- *No party ever saw more than one share* — **not yet.** P3-A6.

Do not let the submission text or the video blur these two. Overstating the security posture of
a custody product is the failure mode this file opens with.

**Dev A's remaining work is P3-A6** (distributed DKG over `frostd`) and then Phase 4. Everything
else on Dev A's side is merged. 37 tests pass, 2 ignored (they need a live `frostd`).

### The randomizer — read this before touching signing

For Zcash, **use the deprecated `frost_rerandomized::sign()` with an explicit `Randomizer`**,
and `RandomizedParams::from_randomizer()` to aggregate.

Do **not** "modernise" to `sign_with_randomizer_seed()`. It *derives* the randomizer from a seed
plus the round-1 commitments, so it cannot produce the alpha the transaction already fixed. The
only public API that accepts an explicit randomizer is the deprecated one, because
`KeyPackage::randomize` is private. Raised upstream as
[ZcashFoundation/frost#1094](https://github.com/ZcashFoundation/frost/issues/1094).

An earlier version of this file said the opposite. It was wrong.

### Tooling

Wallet and node work goes through **`zcash-devtool`** (#19), not a GUI wallet — Ironwood
readiness across wallets is still patchy. Its `wallet shield` targets Ironwood automatically,
and its `pczt` subcommand is the reference for P1-A4. Recipe in `secrets/README-devtool-wallet.md`.

### Open, and not ours alone

- **#24 — Supabase is readable and writable by anyone.** Publishable key in public git history,
  live reads and writes, zero RLS. The web sign route counts DB rows, so anyone can fake quorum.
  Partly addressed in PR #27 (credentials rotated, read-only RLS) but writes still originate in
  the browser, and `migration.sql` still carries RLS=0 while `supabase_schema.sql` has RLS=5.
- **#15 — two schema sources of truth** (`schema.prisma` and `supabase_schema.sql`), unassigned.
- **The web app is still not wired to the Rust core** (P3-B1). Three specifics, checked 25 Sep:
  - `coordinator-client.ts` calls `/v1/dkg/create`, `/v1/approvals/submit` and friends.
    `quorum-coordinatord` serves `/coordinator/*` and `/signer/*`. **Every live call 404s** —
    setting `COORDINATOR_URL` today makes things worse, not better, so the paths must be
    corrected in the same change that flips the switch.
  - `/api/approvals/[id]/sign` writes `SignatureRoundEvent` rows from a label in the request
    body, defaulting to `"Bob"` / `"APPROVED"`, then counts rows to decide quorum.
  - `/api/vaults/[id]/ceremony` (PR #31, "DKG ceremony integration") sets `status = ACTIVE` and
    stores a `shieldedAddress` the **client supplied**. No DKG runs.
  Until this is wired, every UI surface that implies signing must say **simulated** on screen —
  not in a tooltip, and not only in the README.
