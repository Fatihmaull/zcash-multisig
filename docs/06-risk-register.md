# 06 — Risk register

Ordered by expected damage. Each risk has a named trigger — an observable condition with a date,
not a feeling — so that switching paths is a decision rather than a panic.

---

## R1 — PCZT v2 + Ironwood does not work in time

| | |
|---|---|
| **Likelihood** | Medium |
| **Impact** | Fatal — no demo |
| **Trigger** | Gate B missed on **27 Sep** |

PCZT v2 with Ironwood sits on release candidates (`pczt 0.8.0-rc.1`,
`zcash_client_backend 0.24.0-rc.1`) with open upstream issues (librustzcash #2467, #2525). The
intersection we need — PCZT across devices × Ironwood × rerandomized FROST — is the newest
combination of the three.

**Mitigation:** resolve feasibility in spike S2 during week 1, not on day 12. Pin exact
versions and commit `Cargo.lock`.

**Fallback — the degraded demo.** In priority order:

1. **Ironwood spend without multi-device PCZT.** Assemble the transaction in one coordinator
   process while FROST signing still happens across three genuinely separate signer processes
   holding separate shares. The threshold property — the thing we claim — is preserved and
   demonstrable. Multi-device PCZT assembly becomes roadmap.
2. **Sapling-pool spend, threshold-signed.** Sapling is mature and well-supported. Demo it
   working, then explain on camera exactly what blocks Ironwood today, citing the upstream
   issues by number. A team that can name precisely why the bleeding edge is not ready reads as
   competent to a Zcash judge, not as failed.
3. **FROST signing verified, broadcast stubbed.** Last resort. Show a valid aggregated RedDSA
   signature and be explicit on camera that broadcast is not wired. Never imply otherwise.

**Never** fake a confirmation, dress a stub as a working transaction, or show a mainnet
explorer link for a testnet transaction.

## R2 — The demo is rushed

| | |
|---|---|
| **Likelihood** | **High** — this is the default outcome |
| **Impact** | Severe |
| **Trigger** | Recording has not started by **5 Oct** |

Hackathon projects lose because the video was recorded at 2am on deadline day, not because the
code was bad. Communication is an explicit Colosseum judging criterion.

**Mitigation:** Gate C is a real feature freeze on 4 Oct. Demo production is owned by a named
person from day 1, not treated as leftover time. Submit 10 Oct with two days of deliberately
unused buffer.

**Fallback:** cut features, never the demo. A smaller product presented well beats a larger one
presented badly, and the margin is not close.

## R3 — Zero traction

| | |
|---|---|
| **Likelihood** | **Certain** |
| **Impact** | Fatal for the general pool, survivable for the track |
| **Trigger** | Already true |

Colosseum judges on demonstrated user traction or revenue. Our users — foundation treasurers,
ETPs, custodians — are enterprise sales cycles measured in months. We will have zero users on
12 October. This cannot be fixed by coding.

**Mitigation:** accept that the general pool is a lottery ticket and optimise every trade-off
for the track, where 10 slots against 50–100 submissions means we need the top ~15%, not the top
1%. Substitute letters of intent from recognisable ecosystem names — see
[09-traction.md](09-traction.md). **Start week 1.** Lead time is measured in weeks.

## R4 — Infrastructure eats the calendar

| | |
|---|---|
| **Likelihood** | Medium-high |
| **Impact** | Severe |
| **Trigger** | No working Ironwood-aware node access by **20 Sep** |

Zebra testnet sync plus Zaino indexing is realistically 3–4 days — 15% of the remaining calendar
spent on something that is not the product.

**Mitigation:** decide on day 1 (spike S3). Prefer a public testnet endpoint. If self-hosting,
start the sync on day 1 so it runs in the background.

**Fallback:** public endpoint even with reduced capability; scope the demo to what it supports.

## R5 — Both people converge on the Rust problem

| | |
|---|---|
| **Likelihood** | Medium-high |
| **Impact** | Severe |
| **Trigger** | No UI work has begun by **27 Sep** |

The protocol integration is the interesting problem and it will attract both people. Meanwhile
the product — the entire thing a judge sees — goes unbuilt.

**Mitigation:** the role split in [05-plan.md](05-plan.md) is binding. Owner B builds the UI
against a mocked coordinator during week 2 and does not wait for the real one.

## R6 — Overstated security claims

| | |
|---|---|
| **Likelihood** | Medium |
| **Impact** | **Reputational, and permanent** |
| **Trigger** | Any draft containing "audited", "secure", "production-ready", or "quantum-resistant" |

`frost-core` is audited by NCC Group. **`frost-rerandomized` is not covered by that audit** and
still carries an API-may-change warning. ZIP-312 is Draft. ZIP-2005 provides quantum
*recoverability*, not quantum security — RedPallas remains vulnerable to Shor's algorithm.

Overstating the security posture of a custody product in front of an audience of cryptographers
is worse than missing the deadline. A missed deadline is forgotten in a month.

**Mitigation:** one named person reviews every external claim before publication — submission
text, README, video narration, LOI emails. Default to understatement. When unsure whether
something is audited, write that we are unsure.

## R7 — Positioned into the Zcash Foundation's lane

| | |
|---|---|
| **Likelihood** | Medium |
| **Impact** | Moderate — loses the track, not the build |
| **Trigger** | Any draft describing Quorum as "FROST tooling for Zcash" |

ZF's 2026 roadmap includes FROST v3, finalising ZIP-312, and implementing DKG. They ship
`frostd` and `frost-client`. If we frame ourselves as their category, we are a worse version of
work they are already doing and a judge from ZF will say so.

**Mitigation:** we are a **governance product that uses FROST**, never FROST tooling. Frame ZF
as tailwind — their work de-risks our stack — and say so explicitly in the submission. See
[01-strategy.md](01-strategy.md) §3.

## R8 — Scope creep

| | |
|---|---|
| **Likelihood** | Medium |
| **Impact** | Moderate to severe |
| **Trigger** | Any work begins on the out-of-scope list in [02-product-spec.md](02-product-spec.md) §5 |

Tiered quorum policies, hardware wallets, and signer rotation are all genuinely good and all
wrong for this month.

**Mitigation:** every addition must name what it displaces. Claude Code is instructed to flag
drift unprompted — see [CLAUDE.md](../CLAUDE.md).

## R9 — Upstream moves under us

| | |
|---|---|
| **Likelihood** | Low-medium |
| **Impact** | Moderate |
| **Trigger** | A build breaks after a dependency update |

We depend on release candidates in active development.

**Mitigation:** pin exact versions, commit `Cargo.lock`, and **stop updating dependencies after
27 Sep** unless a pinned version is actively broken. Chasing upstream during a hackathon is a
self-inflicted loss, not diligence.

## R10 — Demoing the wrong pool

| | |
|---|---|
| **Likelihood** | Low, now that it is documented |
| **Impact** | Severe |
| **Trigger** | The word "Orchard" appears as a target anywhere outside the fallback plan |

Orchard has been exit-only since 28 July 2026. This was an error in the original brief and is
recorded here so it cannot quietly return.

**Mitigation:** [04-technical-constraints.md](04-technical-constraints.md) C1. The only
legitimate mention of Orchard is in R1's fallback, and there only alongside Sapling as an
explicitly-labelled degraded path.
