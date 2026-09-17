# 01 — Strategy

Why this track, how we are positioned, and how we score against the criteria we are actually
judged on.

---

## 1. Track selection came before idea selection

This was deliberate and it is the highest-leverage decision in the project.

Colosseum's previous Solana hackathon drew ~2,857 submissions. Crypto World's Fair spans eight
ecosystem tracks with very different prize-to-competition ratios, and every entrant is also
eligible for the general pool regardless of chain. The expected value of a thin track is
materially higher for the same effort.

**The numbers are better than our original estimate.** Colosseum's own grant proposal to Zcash
Community Grants states their expectation for the Zcash track:

| | |
|---|---|
| Expected submissions | **50–100** |
| Winning slots | **10 × $10,000** |
| Implied hit rate | **10–20%** |
| Solana track, for comparison | ~10 slots against a likely four-figure field — roughly 1% |

We do not need to be exceptional. We need to be in the top ~15% of a small, specialised field.
That is a completely different engineering target from "beat 2,857 teams", and it should change
how we spend the 26 days: **depth and correctness over breadth and polish**.

## 2. Why Zcash over Tempo

The shortlist was Tempo and Zcash.

**Tempo** — Stripe/Paradigm L1, mainnet March 2026, full EVM on Reth, sub-second deterministic
finality, no native token, permissioned validators, payments-first with a Machine Payments
Protocol for agent-initiated payments. Fast to ship on, familiar tooling. Rejected because
"an AI agent that pays autonomously" is the most saturated idea of 2026, and the obvious layer
on top of MPP is the layer Stripe builds itself.

**Zcash** — Bitcoin-derived UTXO chain, no smart contracts, privacy optional via shielded pools.
Building here is client-level Rust work, not contract deployment. High barrier, very thin
competition.

Within Zcash we ranked five ideas: an audit/selective-disclosure portal, FROST-based custody,
shielded payroll for high-risk organisations, PCZT air-gapped approval flows, and post-quantum
migration tooling. FROST custody won on three grounds: a proven revenue model, a protocol timing
window that is open right now, and public evidence that the gap is real.

**We then merged idea 1 back in.** See §4.

## 3. The Zcash Foundation problem — and our answer

We rejected Tempo partly because Stripe would build the obvious layer itself. **That same test,
applied honestly, hits Zcash at least as hard.** The Zcash Foundation's 2026 roadmap commits to
releasing FROST v3, finalising ZIP-312, and implementing DKG for key generation and secure
multiparty signing. They already ship `frostd` and `frost-client`. They are active in exactly
this space.

We did not apply our own test symmetrically. Naming that here so it stops being a blind spot.

**The answer is not that the risk is absent — it is that it is a different lane.** ZF builds
protocol and reference tooling: correct, general, CLI-shaped, for people who already understand
threshold signatures. Nothing in their roadmap is a product for a foundation treasurer who has
never heard the word "ciphersuite".

Two consequences, both binding:

- **Never position Quorum as "FROST tooling for Zcash."** We lose that framing immediately and
  deservedly. We are a governance product that happens to use FROST.
- **Frame ZF as tailwind, not competition, and say so out loud.** Their finalising ZIP-312 and
  shipping DKG de-risks our dependency stack. A judge who works at ZF should come away thinking
  we make their work more useful, not that we are racing them.

## 4. Positioning

> Not the cryptography. Not the transport. The organisational layer in between.

**The founder story — this leads the pitch.** The team's background is security audit and GRC.
That is genuine founder-market fit for shared-control governance, and it is more relevant here
than another Rust cryptographer would be:

> "I come from GRC. I have watched organisations fail controls audits because 'the treasurer
> holds the seed phrase' is not a control. Zcash shielded funds currently have no way to express
> a control at all."

This also drove a scope correction. The original shortlist put an audit/selective-disclosure
portal at number one and then discarded it — discarding the idea that matched the founder and
keeping the one with the better business model. The two are not separate problems: an
organisation that needs 2-of-3 shielded control **also** has to prove to a grant funder where
the money went. So the audit trail in scope is **viewing-key-backed**, not an application event
log. An event log is a database table anyone can forge. A viewing-key-derived record is
cryptographic evidence a third party can verify independently. See
[02-product-spec.md](02-product-spec.md) §5.

## 5. Market

| Figure | Value | Verified |
|---|---|---|
| ZEC in shielded pools | 4.89M ZEC — **28.9% of supply** | 16 Sep 2026 |
| Shielded value | **~$5.8B** | 16 Sep 2026 |
| ZEC price / market cap | ~$1,178 / $19.9B | 16 Sep 2026 |
| Shielded share, one year prior | 23.3% (7.6% five years prior) | 16 Sep 2026 |

The growth trend matters more than the absolute number: shielded share is compounding, and none
of that value currently has adequate organisational controls.

**Early users**, in defensibility order:

1. **Grant recipients accounting for shared funds** — reachable now, small, and they feel both
   halves of the problem (control *and* disclosure).
2. **ETPs and treasury companies** — a spot ETF reportedly held ~387k ZEC as of August 2026.
   *Unverified — verify before this appears in any pitch.*
3. **Custodians wanting to add shielded support.**
4. **Post-NU7 lockbox distribution** — ZF has publicly named FROST as a requirement. Demoted
   from first position because **NU7 has not happened**; coinholder voting opened 25 Aug 2026.
   Referencing it as imminent is a factual error a Zcash judge will catch.

**Two arguments we are dropping.** "Even Coinbase can receive from shielded addresses but cannot
send to them" is weak regardless of whether it is true — exchange shielded support is a
different problem from organisational control, so it does not evidence our gap. And
"non-custodial keeps us out of custody licensing regimes" is overstated; see §7.

## 6. Scoring against the judging criteria

Colosseum judges on founder-market fit, unique insight, product execution, TAM, communication,
business viability, and demonstrated traction or revenue.

| Criterion | Where we stand | What we do about it |
|---|---|---|
| Founder-market fit | **Strong but currently buried** | Lead with the GRC story. Keep the viewing-key audit trail — it is the feature only this founder thinks of. |
| Unique insight | **Strong** | The v6 deferrable anchor (§ [04](04-technical-constraints.md)) is sharper than anything in the original brief. Lead the technical section with it. |
| Product execution | **Strong if Gate B lands** | All engineering risk is concentrated here. Retire it by 27 Sep. |
| TAM | **Adequate** | $5.8B shielded, compounding. Be honest that the number of *organisations* is small today; argue the trend. |
| Communication | **Controllable** | Feature freeze 4 Oct, recording 5 Oct. See [07-demo-script.md](07-demo-script.md). |
| Business viability | **Weakest** | Custody fees are a known model, but we are explicitly non-custodial. Have a real answer ready: per-seat governance SaaS, not basis points on assets. |
| Traction / revenue | **Zero, and unfixable by coding** | Letters of intent from recognisable ecosystem names. See [09-traction.md](09-traction.md). Start week 1. |

**The general pool is not a target.** Top-23 overall against thousands of entries, judged heavily
on traction we cannot earn in 26 days. We are eligible and we will be entered automatically;
treat any general-pool result as a lottery win, and optimise every trade-off for the track.

## 7. Regulatory framing

Non-custodial is the correct design and a genuinely strong argument — but it is an argument, not
a safe harbour. FinCEN's "control" analysis and MiCA's CASP definitions look at facts, not
labels. The team's GRC background is exactly what makes precision here an asset rather than a
liability, so write it precisely instead of waving it away:

- Say: key shares never touch our infrastructure; we cannot move funds unilaterally or in
  collusion with any single signer; we are a coordination and record-keeping service.
- Do not say: "we are not regulated" or "this keeps us out of licensing regimes."
- Frame the product as **auditable privacy**, not anonymity. Shielded funds *with* provable
  disclosure to the parties entitled to it. That framing is true, it is the differentiator, and
  it keeps the conversation with any serious institutional user open.
- Describe target users as organisations with **fiduciary reporting duties** — foundations,
  grant recipients, treasury vehicles. Avoid "high-risk organisations" as a segment label.
