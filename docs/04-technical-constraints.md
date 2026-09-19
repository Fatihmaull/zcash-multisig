# 04 — Technical constraints

Every fact below was verified **15–16 September 2026**. Library versions, ZIP-312 status, and
NU7 timing move. Re-verify before relying on any of it, and update this file with the date when
you do.

---

## Verified state of the world

| Fact | Value | Source |
|---|---|---|
| Ironwood activation | **28 July 2026**, mainnet block 3,428,143 | CoinDesk, KuCoin |
| Ironwood's formal name | **NU6.3** — *not* NU7 | Zcash docs / coverage |
| Why Ironwood exists | Replaced Orchard after a bug permitting counterfeit ZEC with no public trace | crypto.news |
| Orchard status | **Exit-only** — withdrawals allowed, no new shielded activity | CoinDesk |
| Ironwood migration, day 1 | ~176,000 ZEC (~$81M), ~5% of Orchard's balance | CoinDesk |
| NU7 | **Has not happened.** Coinholder vote opened 25 Aug 2026 | Zcash community |
| ZIP-2005 | Changes **note construction** for quantum recoverability. Does **not** change the spend-authorization signature scheme | zips.z.cash/zip-2005 |
| RedPallas / RedDSA | Still the spend-authorization scheme under Ironwood | ZIP-2005 |
| `frost-core` | **v3.0.0** released and stable, audited by NCC Group | ZcashFoundation/frost |
| `frost-rerandomized` | **Not covered by the NCC audit.** API-may-change warning still present | ZcashFoundation/frost |
| PCZT v2 + Ironwood | Release candidates: `pczt 0.8.0-rc.1`, `zcash_client_backend 0.24.0-rc.1`. Open upstream issues | librustzcash #2467, #2525 |
| v6 transaction format | "v5 plus an Ironwood bundle". `Transaction::V6` adds `ironwood_shielded_data` | Zebra #10762 |
| v6 anchors | **Authorizing data** — selectable after signatures are collected | librustzcash #2525 |
| ZIP-312 | Still **Draft**. ZF's 2026 roadmap commits to finalising it | zips.z.cash/zip-0312, zfnd.org |
| `zcashd` | Retired. Z3 stack (Zebra, Zaino, Zallet) is current | Zcash ecosystem |

---

## C1 — Target Ironwood, never Orchard

**The single most important correction to the original brief.** The original technical
constraints referred throughout to "Sapling/Orchard spend authorization signatures" and never
mentioned Ironwood.

Orchard has been exit-only since 28 July 2026. A demo that spends from Orchard is demoing a
deprecated pool at a hackathon sponsored by the community that deprecated it, two months after
the fact. A Zcash-track judge notices this in the first fifteen seconds and correctly concludes
we stopped reading in August.

**Failure mode if ignored:** instant loss of technical credibility with the only audience that
matters, independent of code quality.

## C2 — NU7 has not happened; Ironwood is NU6.3

Do not build against NU7 behaviour. Do not lead the pitch with post-NU7 lockbox distribution as
a user story — it is contingent on an upgrade still under coinholder vote. ZF has publicly named
FROST as a requirement for lockbox distribution, which makes it a legitimate *roadmap* argument
and an illegitimate *today* argument.

**Failure mode if ignored:** a confidently stated factual error about the sponsor's own
protocol timeline.

## C3 — v6 anchors are authorizing data (lead the technical pitch with this)

In the v6 format, Sapling / Orchard / Ironwood anchors are **authorizing data**, so the anchor
can be chosen after signatures are collected — at broadcast time, when re-anchoring.

Why this is the most interesting thing in this document:

Threshold approval is slow by nature. Signer 1 approves at 09:00; signer 2 opens their laptop at
16:00. Under the older format, the anchor fixed at build time goes stale across that gap, the
transaction must be rebuilt, and **every signature already collected is discarded**. That is not
a minor annoyance — it is the reason naive shielded multisig UX does not work for real
organisations.

v6 removes it. This is the concrete technical answer to "why now", it is specific enough to
prove we read the spec rather than the marketing, and it is a stronger unique insight than
anything in the original brief.

**Architectural consequence:** never bind the anchor at PCZT build time as a convenience.
Defer it to broadcast. Track librustzcash #2525 — anchor deferrability in v6 PCZTs is an open
upstream issue, so confirm the current behaviour in spike S1 rather than assuming the design
is settled.

## C4 — RedPallas ciphersuite, never the Ed25519 default

Pass `-C redpallas` to every `frost-zcash-demo` binary. RedPallas (RedDSA over Pallas, from the
`reddsa` crate) is what makes signatures valid as Zcash spend authorizations, and selecting it
automatically switches to rerandomized FROST.

Confirmed still correct under Ironwood: ZIP-2005 changes how notes are constructed — note
commitment randomness now derives from a BLAKE2b hash of all note fields, making commitments
quantum-binding — but the spend-authorization signature remains RedDSA. The specified future
Recovery Protocol still requires a RedDSA signature verifiable by the spend validating key.

Note the honest limitation for any security claim we make: ZIP-2005 provides quantum
*recoverability*, not quantum security. RedPallas remains vulnerable to Shor's algorithm. Never
describe Quorum as quantum-resistant.

**Failure mode if ignored:** signatures that are cryptographically valid and useless — they do
not authorize a Zcash spend.

## C5 — DKG needs authenticated AND confidential channels

Signing needs authentication only. DKG needs both. An unauthenticated DKG channel permits a
man-in-the-middle to end up holding a share; a non-confidential one leaks round-1 material.

Treat as a first-class architectural requirement. During spike S1, verify what `frostd` actually
guarantees — confirm TLS, and confirm how participants authenticate to *each other*, not merely
to the server — and record the answer in [03-architecture.md](03-architecture.md) §2.

**Failure mode if ignored:** an attacker is silently inside the vault from the moment of key
generation, and nothing downstream can detect or repair it.

## C6 — FROST v3.x API

`frost-core` v3.0.0 is released. The rerandomized API was reworked for Zcash integration:

- **All signing parties contribute randomness**, rather than one party supplying it. Do not
  reintroduce a single-source randomizer.
- `RandomizedParams` generates a randomizer from signing commitments plus fresh randomness, and
  can recreate the same randomizer from a stored seed.
- **`InvalidSignatureShare::culprit` became `culprits`** — a vector. This is the type behind the
  misbehaving-signer feature (F4), so the change is directly load-bearing for us.
- `frost-rerandomized` is now re-exported from the ciphersuite crates.
- Cheater detection, repair, and refresh-share were refactored.

Read the changelog before pinning. Most tutorial content online predates v3.

## C7 — PCZT v2 + Ironwood is on release candidates

`pczt 0.8.0-rc.1`, `zcash_client_backend 0.24.0-rc.1`, with open upstream issues
(librustzcash #2467, #2525).

**This is where the claim "we are not building cryptography" is weakest, and we should be honest
with ourselves about it.** FROST is done. PCZT for v5 is done. The intersection we actually need
— PCZT across devices **×** Ironwood **×** rerandomized FROST — is the newest combination of the
three and is partly unresolved upstream. Each piece exists; the combination has few travellers.

Rules:

- Pin exact versions. Commit `Cargo.lock`.
- Do not chase upstream mid-hackathon. A broken build on day 20 because a release candidate
  moved is a self-inflicted loss.
- Resolve feasibility in spike S1, not on day 12. This risk owns Gate B.

## C8 — ZIP-312 is Draft

We are building against a specification that may still change. ZF's 2026 roadmap commits to
finalising it, so the trajectory is favourable — but flag in code comments anywhere the design
depends on draft behaviour, and say so plainly in the submission. Judges respect a team that
knows which ground is soft.

## C9 — Z3 stack, testnet only, no mainnet funds

Zebra, Zaino, Zallet. `zcashd` is retired.

**Testnet only for the entire build. No mainnet funds, ever.** Not for a "quick check", not for
the demo, not for a screenshot. An unaudited threshold-signing integration against real money is
the one mistake with permanent consequences, and the demo is not improved by it.

---

## Open questions for spike S1

Answer these before writing application code, and record the answers here.

1. ~~Does `frost-zcash-demo` run end to end with `-C redpallas`?~~ **Partly.**
   `trusted-dealer -C redpallas` works; `frostd`'s redpallas router test and the frost-client
   suite pass. But the standalone `coordinator` binary is **CLI-transport only** — it hardcodes
   `CLIComms` despite advertising socket mode. The real multi-process path is
   `frost-client` + `frostd`. Also: **the demo is on FROST v2**, so it is not a v3 reference.
   See [12-spike-s1-report.md](12-spike-s1-report.md) §1 and §6.
2. ~~What is the real v3.x API surface for rerandomized signing?~~ **Answered.** `sign()` is
   deprecated; use `sign_with_randomizer_seed()` with a seed from
   `RandomizedParams::new_from_commitments()`. Full flow in
   [12-spike-s1-report.md](12-spike-s1-report.md) §4, executable in
   `packages/core/quorum-core/tests/redpallas_v3_smoke.rs`.
3. ~~Can `pczt 0.8.0-rc.1` build a v6 transaction with an Ironwood bundle?~~ **Yes** — it
   carries `ironwood: orchard::Bundle` and the Signer role handles `ValuePool::Ironwood`.
   **Anchor deferral remains unverified** (#2525 still open) — now a Phase 1 risk, P1-A4.
4. **Still open.** Does `zcash_client_backend 0.24.0-rc.1` scan the Ironwood pool, and does its
   proto match the endpoint's `CompactTx` field 9 `ironwoodActions`? Moved to P1-B1.
5. ~~What exactly does `frostd` guarantee?~~ **Answered: TLS to the server, plus Noise
   `Noise_K_25519_ChaChaPoly_BLAKE2s` participant-to-participant.** Recorded in
   [03-architecture.md](03-architecture.md) §2.
6. ~~Is there a public testnet Zaino/lightwalletd endpoint serving Ironwood, or must we
   self-host?~~ **Answered 19 Sep 2026: yes.** `testnet.zec.rocks:443` serves Ironwood —
   `CompactTx.ironwoodActions`, `ChainMetadata.ironwoodCommitmentTreeSize`, and
   `GetTreeState.ironwoodTree` all present. See [03-architecture.md](03-architecture.md) §6.
7. ~~What is the testnet Ironwood activation height, and is our node past it?~~
   **Answered 19 Sep 2026: height 4,134,000** (Zebra 6.0.0-rc.0). The chosen endpoint was at
   4,367,867 when checked, with an Ironwood commitment tree of 307,456 notes.
8. ~~How does `zcash-sign` structure externally generated signatures?~~ **Answered, and it
   surfaced a blocker.** It uses `orchard::pczt::Bundle` with the `unstable-frost` feature and
   collects randomizers from the bundle. But it derives the vault's full viewing key via
   `FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed()`,
   which exists only in a fork (zcash/orchard#475, **still open**) and is named for being
   incompatible with the very property Ironwood exists to provide.
   **Open question for the Zcash Foundation** — see
   [12-spike-s1-report.md](12-spike-s1-report.md) §7.
