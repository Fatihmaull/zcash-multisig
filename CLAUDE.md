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
- **Be pedagogical about Rust at the protocol-integration level.** Explain the cryptographic
  reasoning as you go; do not just hand over working code. The team's strength is Next.js,
  Tailwind, Django, Laravel, plus a security-audit and GRC background. Rust protocol
  integration is the weak spot and the place to slow down.
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
6. **PCZT v2 + Ironwood is on release candidates** (`pczt 0.8.0-rc.1`,
   `zcash_client_backend 0.24.0-rc.1`) with open upstream issues. Pin exact versions, commit
   `Cargo.lock`, do not chase upstream mid-hackathon.
7. **ZIP-312 is still Draft.** The Zcash Foundation's 2026 roadmap says it is being finalised.
   Flag anywhere our design depends on draft behaviour.
8. **Build on the Z3 stack** (Zebra, Zaino, Zallet). `zcashd` is retired.
9. **Testnet only. No mainnet funds, ever, during this build.**

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
| 21 Sep | **A** — `frost-zcash-demo` running with RedPallas, coordinator + 2 participants. Verdict on PCZT v2 + Ironwood. |
| 27 Sep | **B** — 2-of-3 shielded Ironwood spend confirmed on testnet, CLI only. **No UI required.** |
| 4 Oct | **C** — end to end through the web UI. **Feature freeze.** |
| 5 Oct | **D** — demo recording begins. |
| 10 Oct | **E** — submit, two days early. |

Missing Gate B triggers the degraded demo in [docs/06-risk-register.md](docs/06-risk-register.md).
It is a decision point, not a reason to push harder on the same path.

---

## Current phase

**Pre-development.** No application code yet.

The next action is spike **S1** — tasks P0-A1 through P0-A5 in
[docs/10-roadmap.md](docs/10-roadmap.md): read
`ZcashFoundation/frost` and `ZcashFoundation/frost-zcash-demo`, get the demo running locally
with RedPallas — coordinator and participants in separate terminals — then report on the real
v3.x API surface, where the developer experience breaks down, and what should change about the
scope above based on what was found.

Do not write application code before S1 reports back.
