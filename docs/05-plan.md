# 05 — Plan

**24 days.** 17 September → 10 October 2026 (hard deadline 12 October). No extension exists.

This document owns the **gates and the reasoning behind them**. The task-level breakdown — every
task, its estimate, its owner and its dependencies — lives in [10-roadmap.md](10-roadmap.md).
Where dates disagree, 10-roadmap.md is authoritative.

---

## Gates

Each gate is a go/no-go decision with a date and an owner, not a milestone to slip past.

| Gate | Date | Condition | If missed |
|---|---|---|---|
| **A** | **21 Sep** | `frost-zcash-demo` runs with `-C redpallas`, coordinator + 2 participants in separate terminals. Written verdict on PCZT v2 + Ironwood feasibility. | Stop feature work. All hands on the spike. This gate cannot slip past 22 Sep. |
| **B** | **27 Sep** | A 2-of-3 shielded **Ironwood** spend confirms on testnet. **CLI only — no UI required.** | Trigger the degraded demo in [06-risk-register.md](06-risk-register.md). This is a decision point, not a reason to push harder on the same path. |
| **C** | **4 Oct** | The full flow works through the web UI. **Feature freeze.** | Ship what works. Cut F6 first, then F3 reminders. |
| **D** | **5 Oct** | Demo recording begins. | Nothing else matters more. Stop coding. |
| **E** | **10 Oct** | Submitted, two days early. | — |

> **Gate B is the whole project.** Everything before it exists to retire one risk: can a
> threshold-signed shielded Ironwood transaction actually land? Everything after it is user
> interface. Do not let UI work start before Gate B except where it runs genuinely in parallel
> on a separate person.

## Roles

Two people. The original brief was written in the first person; it needs an explicit split or
both people converge on the interesting Rust problem and nobody builds the product.

| | **A — Protocol** | **B — Product** |
|---|---|---|
| Owns | `quorum-signer`, `quorum-coordinator`, FROST integration, PCZT, testnet infrastructure | Next.js app, coordination UX, misbehaviour surfacing, audit export, **demo production** |
| Gate ownership | A, B | C, D |
| Week 1 | Spikes S1–S3 | Testnet infra (runs in background), UI skeleton against mocked coordinator |
| Risk | Rust at protocol level is the team's weak spot — budget learning time, do not pretend otherwise | Demo production is a real job, not leftover time |

**Demo production belongs to one named person from day 1.** It is the most common thing a
hackathon team discovers it forgot.

## Week 1 — 17–21 Sep · Retire the unknowns

Goal: know whether this project is buildable. Write no application code.

**Spike S1 — the demo runs** *(owner A, days 1–3)*
Read `ZcashFoundation/frost` and `ZcashFoundation/frost-zcash-demo`. Get the demo running
locally with RedPallas — `cargo run --bin trusted-dealer -- -C redpallas`, then `dkg`,
`coordinator`, `participant` in separate terminals. Report on the real v3.x API surface, where
the developer experience breaks down, and what should change about the scope based on what was
found.

**Spike S2 — Ironwood reachable** *(owner A, days 2–5, overlapping S1)*
Answer open questions 3, 4, 6 and 7 in [04-technical-constraints.md](04-technical-constraints.md).
Can `pczt 0.8.0-rc.1` build a v6 transaction with an Ironwood bundle? Does
`zcash_client_backend 0.24.0-rc.1` scan the Ironwood pool? Is anchor deferral implemented or
still open per librustzcash #2525?

**Spike S3 — infrastructure decision** *(owner B, day 1, then background)*
Public testnet Zaino/lightwalletd endpoint serving Ironwood, or self-host Zebra + Zaino? Decide
**on day 1**. If self-hosting, start the sync on day 1 so it runs while other work proceeds.
See [03-architecture.md](03-architecture.md) §6.

**Parallel, non-code** *(owner B, ongoing from day 1)*
Begin the outreach in [09-traction.md](09-traction.md). This is the one judging criterion that
cannot be earned by coding, and it has a lead time measured in weeks, not days. Starting it in
week 4 is starting it too late.

**→ Gate A, 21 Sep.**

## Week 2 — 23–29 Sep · Land the happy path

Goal: one shielded Ironwood spend, threshold-signed, confirmed on testnet.

- Implement the signer/coordinator split with shares held only on the participant side. Use
  `zcash-sign` from `frost-zcash-tools` as the reference pattern for externally generated
  signatures.
- DKG over authenticated **and** confidential channels (C5). Verify what `frostd` actually
  guarantees; do not assume.
- Build the PCZT with an Ironwood bundle. **Defer the anchor to broadcast** (C3).
- Round 1 and round 2 with all parties contributing randomness (C6).
- Aggregate, finalise, broadcast, confirm.
- In parallel (owner B): UI skeleton — vault creation, request list, signer status — against a
  mocked coordinator, so the interface is ready to connect the moment the core works.

**→ Gate B, 27 Sep.** Miss it and switch paths; do not spend week 3 on the same wall.

## Week 3 — 30 Sep – 6 Oct · Make it a product

Goal: a treasurer can do all of it without reading FROST documentation.

- Wire the real coordinator to the UI.
- **F1** — guided 2-of-3 key ceremony. The security-critical moments must be legible: what a
  share is, why it is never copied to a colleague, what happens if it is lost.
- **F3** — signer status, reminders, and non-responding signer as a first-class state.
- **F4** — misbehaving-signer detection. Map `InvalidSignatureShare::culprits` to a
  human-readable event naming the participant, stating that no funds moved, and saying what to
  do next. This is the feature that wins the track; give it real design attention.
- **F6** — viewing-key-backed audit export, CSV and JSON. **First thing cut if Gate C is at
  risk.**
- Write the submission text. Do not leave it to the final weekend.

**→ Gate C, 4 Oct. Feature freeze.** After this date: bug fixes and demo only. No new features,
no refactors, no "quick improvements."

## Week 4 — 7–12 Oct · Ship

- **5 Oct — recording begins** (Gate D). See [07-demo-script.md](07-demo-script.md).
- Rehearse the run on a clean environment. Record multiple takes. Expect the first three to be
  unusable.
- Finalise submission text, README, and the security-posture statement. Re-read
  [01-strategy.md](01-strategy.md) §7 and the security note in the root README before writing a
  single claim about audits or safety.
- **10 Oct — submit.** Two days of buffer, deliberately unused.
- 11–12 Oct — buffer only. Do not start anything here.

## Standing rules

1. **Testnet only. No mainnet funds, ever.**
2. Pin exact crate versions. Commit `Cargo.lock`. Do not chase upstream after 27 Sep.
3. If recording has not started by 5 Oct, that is the top-priority problem regardless of what
   else is unfinished.
4. Every scope addition must name what it displaces. There is no free space in this calendar.
5. When the protocol work is confusing, slow down and understand it. A confidently wrong
   cryptographic integration is worse than an unfinished one — it is the failure mode that
   embarrasses us in front of the exact audience we are trying to impress.
