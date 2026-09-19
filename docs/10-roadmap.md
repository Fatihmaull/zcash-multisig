# 10 — Roadmap & work breakdown

Execution-level companion to [05-plan.md](05-plan.md). That document says *when* the gates are
and *why*; this one says *what exactly to do* and *who does it*.

---

## Window

| | |
|---|---|
| Today | **17 Sep 2026** |
| Build window | 17 Sep → 10 Oct — **24 days** |
| Target submission | **10 Oct** (two days of deliberately unused buffer) |
| Hard deadline | 12 Oct |

**Gate A moves from 20 → 21 Sep.** Phase 0 now starts on the 17th rather than the 16th; the day
is taken here rather than borrowed from Phase 1. Gates B–E are unchanged.

## Two targets, not one

| Target | Means | When |
|---|---|---|
| **Submission-worthy** | A testnet demo that proves the threshold property works, presented well enough to win the Zcash track | **10 Oct** — Phases 0–4 |
| **Actually usable** | Something a foundation could hold real funds in | **Not by 12 Oct**, and partly not up to us — see Phase 5 |

Conflating these is how custody projects get people hurt. Phases 0–4 build the demo. Phase 5 is
the honest path to a product, and it doubles as the roadmap slide for the submission — judges
respect a team that knows the distance between the two.

## Phases at a glance

| Phase | Dates | Days | Goal | Gate |
|---|---|---|---|---|
| **0** | 17–21 Sep | 5 | Retire unknowns. No application code. | **A** — 21 Sep |
| **1** | 22–27 Sep | 6 | Threshold core: a real spend lands on testnet | **B** — 27 Sep |
| **2** | 22–29 Sep | 8 | Product shell, built in parallel against a mock | — |
| **3** | 28 Sep – 4 Oct | 7 | Integration and the six flows | **C** — 4 Oct, feature freeze |
| **4** | 5–10 Oct | 6 | Rehearse, record, submit | **D** — 5 Oct · **E** — 10 Oct |
| **5** | post-12 Oct | — | The path to something actually usable | — |

Phases 1 and 2 overlap deliberately: Dev A drives the core while Dev B builds the interface
against a mock. See [Integration contract](#integration-contract).

## The two developers

| | **Dev A — Protocol** | **Dev B — Product** |
|---|---|---|
| Owns | `quorum-core`, `quorum-signer`, `quorum-coordinator`, FROST, PCZT | Next.js app, infrastructure, node access, DB, **demo production**, traction |
| Gates | A, B | C, D |
| Fails if | The spend never lands | The product is invisible, or the demo is rushed |

> **Assumption flagged.** The team's stated strengths are Next.js, Tailwind, Django, Laravel,
> plus security-audit/GRC — which maps cleanly onto Dev B and leaves **Dev A as the role nobody
> is yet strong in.** Every estimate below for Dev A assumes pairing with Claude Code and
> deliberate learning time. If Dev A slips two days, that is normal, not failure — the response
> is the cut valves in [If you fall behind](#if-you-fall-behind), not longer hours.

---

## Phase 0 — Retire unknowns · 17–21 Sep

**Goal:** know whether this is buildable before committing to building it. **Write no
application code.**

### Dev A

| ID | Task | Est | Depends on |
|---|---|---|---|
| ~~**P0-A1**~~ | ✅ **DONE.** v3 API documented in [12-spike-s1-report.md](12-spike-s1-report.md) §4. | — | — |
| ~~**P0-A2**~~ | ✅ **DONE.** `trusted-dealer -C redpallas` verified; `coordinator` binary found to be CLI-only. Demo is on v2, so a v3 proof was written instead: `quorum-core/tests/redpallas_v3_smoke.rs`, 2 passing tests. | — | — |
| ~~**P0-A3**~~ | ✅ **DONE.** frostd = TLS + Noise_K participant-to-participant. Written into [03-architecture.md](03-architecture.md) §2. | — | — |
| ~~**P0-A4**~~ | ✅ **DONE.** PCZT supports Ironwood (`ironwood: orchard::Bundle`, `ValuePool::Ironwood`). Two broken dependency pins found and fixed. One open issue escalated to ZF — report §7. Anchor deferral and client-backend scanning moved to Phase 1. | — | — |
| ~~**P0-A5**~~ | ✅ **DONE.** Pattern documented; it is what surfaced the FVK issue in report §7. | — | — |

**P0-A4 is the highest-value task in the entire project.** It is the one that tells you whether
Gate B is reachable, and it owns risk R1. Do not let it slip to the end of the phase.

### Dev B

| ID | Task | Est | Depends on |
|---|---|---|---|
| ~~**P0-B1**~~ | ✅ **DONE 19 Sep.** Public endpoint `testnet.zec.rocks:443`, verified to serve Ironwood. Self-hosted Z3 stack kept as a tested, unstarted fallback. Decision and evidence in [03-architecture.md](03-architecture.md) §6. | — | — |
| **P0-B2** | Repo scaffolding: Cargo workspace (`quorum-core`, `quorum-signer`, `quorum-coordinator`), Next.js app, `docker-compose` (Postgres + node), CI running `cargo check`, `cargo clippy`, `tsc`. Pin exact crate versions, commit `Cargo.lock`. | 1.5d | — |
| **P0-B3** | **⬜ REMAINING — needs a human.** Fund a testnet wallet with ZEC **in the Ironwood pool**. Faucets: [zcashfaucet.jinolabs.xyz](https://zcashfaucet.jinolabs.xyz) (0.1 TAZ, shielded z2z, browser PoW), [Fauzec](https://fauzec.com/) (UA `utest1…` or Sapling `ztestsapling…`; no transparent), [Zeropond](http://zeropond.com/). **Note:** faucets pay into Sapling or a UA — getting funds *into Ironwood* likely needs a self-transfer afterwards. Verify which pool the received note lands in before assuming Gate B is fundable. | 0.5d | — |
| **P0-B4** | Draft the DB schema: vaults, participants, approval requests, signer state, events, viewing keys. **No key material anywhere in the schema** — see [03-architecture.md](03-architecture.md) §2. | 1d | — |
| **P0-B5** | **Traction kickoff.** Build the list of 10 contacts, draft the outreach email, post the Zcash Community Forum thread. See [09-traction.md](09-traction.md). | 0.5d + ongoing | — |

### 🚩 Gate A — 21 Sep

- [ ] `frost-zcash-demo` runs with `-C redpallas`: DKG, coordinator, and two participants in separate terminals, producing a valid aggregated signature
- [ ] Written verdict on PCZT v2 + Ironwood feasibility (P0-A4)
- [ ] `frostd` channel guarantees documented in `03-architecture.md`
- [x] Node access working, past testnet Ironwood activation height — `testnet.zec.rocks:443`, verified 19 Sep
- [ ] Funded testnet wallet with Ironwood-pool ZEC
- [ ] Repo scaffolded, CI green
- [ ] 10 outreach contacts made, forum thread live

**If Gate A fails:** stop all feature work; both devs onto the spike. This gate cannot slip past
**22 Sep** without triggering the R1 fallback conversation early.

---

## Phase 1 — Threshold core · 22–27 Sep

**Goal:** a 2-of-3 shielded **Ironwood** spend confirms on testnet. **CLI only — no UI.**

This phase is the whole project. Everything after it is user interface.

### Dev A

| ID | Task | Est | Depends on |
|---|---|---|---|
| **P1-A1** | `quorum-core`: wrap `frost-rerandomized` behind our own types. DKG orchestration over `frostd`, with **authenticated *and* confidential** channels (constraint C5). | 1.5d | Gate A |
| **P1-A2** | `quorum-signer` binary: holds the share, encrypted at rest with a participant-set passphrase. Performs round 1 (commitments + randomness contribution) and round 2 (signature share). **Never transmits the share** — if a code path would move share material across the process boundary, that path is wrong. | 1.5d | P1-A1 |
| **P1-A3** | `quorum-coordinator`: drives the FROST coordinator role, aggregates shares, maps `InvalidSignatureShare::culprits` to a typed domain error rather than letting a library error escape. | 1.5d | P1-A1 |
| **P1-A4** | PCZT assembly with an Ironwood bundle. **Defer the anchor to broadcast** (constraint C3) — never bind it at build time for convenience. | 1.5d | P1-B1 |

### Dev B — Phase 1 share

Dev B owns everything touching the node, because Dev B owns the infrastructure. This keeps Dev A
on cryptography rather than plumbing.

| ID | Task | Est | Depends on |
|---|---|---|---|
| **P1-B1** | Note scanning and spendable-note selection for the Ironwood pool via `zcash_client_backend`. | 1d | Gate A |
| **P1-B2** | Broadcast and confirmation tracking via Zaino. | 1d | P0-B1 |
| **P1-B3** | **Reproducible testnet fixture** — a seeded scenario that can be reset and re-run. You will run the demo dozens of times; hand-rebuilding state each time is a tax you pay every day until the 10th. | 0.5d | P0-B3 |

### 🚩 Gate B — 27 Sep

- [ ] 2-of-3 DKG completes over `frostd` with three separate signer processes
- [ ] A shielded **Ironwood** spend is threshold-signed and **confirms on testnet**
- [ ] An invalid share is detected and the culprit identified, as a typed error
- [ ] No share material has ever crossed into the coordinator process
- [ ] The scenario can be reset and re-run from the fixture

**If Gate B fails:** trigger the degraded demo in [06-risk-register.md](06-risk-register.md) R1.
This is a decision point, not a reason to spend Phase 3 on the same wall.

---

## Phase 2 — Product shell · 22–29 Sep *(Dev B, parallel)*

**Goal:** the interface is ready to connect the moment the core works.

| ID | Task | Est | Depends on |
|---|---|---|---|
| **P2-B1** | **Integration contract** — written jointly with Dev A on day 1 of the phase. See below. | 0.5d | Gate A |
| **P2-B2** | Next.js + Tailwind scaffold, layout, navigation. | 1d | P0-B2 |
| **P2-B3** | DB schema implemented, migrations, seed data. | 0.5d | P0-B4 |
| **P2-B4** | **Mock coordinator** implementing the contract, so UI work never waits on the Rust core. | 0.5d | P2-B1 |
| **P2-B5** | Vault creation and participant-list UI, against the mock. | 1d | P2-B4 |
| **P2-B6** | Approval request list and detail UI, against the mock. | 1d | P2-B4 |

### Integration contract

**The single highest-value thing two developers do in week 1.** A written contract between
`quorum-coordinator` and the web app — endpoints, payload shapes, error taxonomy, and the state
machine for an approval request — agreed on **22 Sep** and changed only by explicit agreement.

Without it, Dev B blocks on Dev A for a week and then discovers on 28 September that the shapes
do not match. With it, the mock and the real core are interchangeable and integration in Phase 3
is a swap rather than a rewrite.

The error taxonomy matters as much as the happy path: `InvalidSignatureShare::culprits` must
arrive at the UI as structured data with a participant identity, not as a string to be parsed.

---

## Phase 3 — Integration and flows · 28 Sep – 4 Oct

**Goal:** a treasurer completes the entire flow without reading FROST documentation.

### Dev A

| ID | Task | Est | Depends on |
|---|---|---|---|
| **P3-A1** | Expose the coordinator over the integration contract, replacing the mock. | 1d | Gate B, P2-B1 |
| **P3-A2** | Misbehaving-signer support: a deterministic, repeatable way to inject a bad share for the demo, plus the culprit mapped to a structured event carrying participant identity. | 1d | P3-A1 |
| **P3-A3** | Non-responding signer: timeouts, clean round abort, resume without that participant. The most common real failure of shared control is not malice — it is someone on a plane. | 1.5d | P3-A1 |
| **P3-A4** | Viewing-key derivation and history query backing the audit export. Derived from the chain, **never reconstructed from the event log**. | 1.5d | P1-B1 |
| **P3-A5** | Hardening: no Rust panic ever reaches the UI. Every error path produces a domain event. | 1d | P3-A1 |

### Dev B

| ID | Task | Est | Depends on |
|---|---|---|---|
| **P3-B1** | Wire the real coordinator, retire the mock. | 1d | P3-A1 |
| **P3-B2** | **F1 — guided key ceremony.** The security-critical moments must be legible to a non-cryptographer: what a share is, why it is never copied to a colleague, what happens if it is lost. This is where "a treasurer can actually do this" is won or lost. | 2d | P3-B1 |
| **P3-B3** | **F3 — signer coordination.** Status per signer, reminders, non-responding as a first-class state rather than an error. | 1.5d | P3-B1 |
| **P3-B4** | **F4 — misbehaving-signer UI.** The human-readable event: who, what failed, that no funds moved, what to do next. **This is the feature that wins the track** — give it real design attention, not a red toast. | 1d | P3-A2 |
| **P3-B5** | **F6 — viewing-key audit export**, CSV and JSON. ⚠️ **First thing cut if Gate C is at risk.** | 1d | P3-A4 |
| **P3-B6** | Draft the submission text. Do not leave it to the final weekend. | 0.5d | — |

### 🚩 Gate C — 4 Oct · **Feature freeze**

- [ ] Three people complete a 2-of-3 DKG through the web UI without reading FROST docs
- [ ] An approval request is created, approved by two of three, and confirms on testnet
- [ ] A corrupted share produces a plain-language event naming the participant
- [ ] Audit trail exports and reconciles against viewing-key-derived on-chain history *(or is formally cut)*
- [ ] Submission text drafted

**After 4 Oct: bug fixes and demo only.** No new features, no refactors, no "quick
improvements". Every hackathon team breaks this rule and most of them regret it.

---

## Phase 4 — Ship · 5–10 Oct

**Goal:** a recorded demo and a submitted project, with buffer left over.

| ID | Task | Owner | Est |
|---|---|---|---|
| **P4-1** | Full rehearsal on a **clean environment**, from the fixture. Find what only breaks on a fresh machine. | Both | 1d |
| **P4-2** | **Record the demo.** Dev B directs and edits; Dev A operates the terminals. Expect the first three takes to be unusable — that is normal and it is why this starts on the 5th. See [07-demo-script.md](07-demo-script.md). | B leads | 2d |
| **P4-3** | Bug fixes arising from rehearsal **only**. No features. | A | 1.5d |
| **P4-4** | Finalise submission: text, README, and the **security-posture review** — every external claim checked against [06-risk-register.md](06-risk-register.md) R6. | B | 1d |
| **P4-5** | Collect and write up LOIs and quotable reactions into the traction section. | B | ongoing |
| **P4-6** | **Submit — 10 Oct.** | Both | — |

**11–12 Oct: buffer. Start nothing here.** It exists so that a problem on the 9th is
inconvenient rather than fatal.

### 🚩 Gate D — 5 Oct · Gate E — 10 Oct

If recording has not started by **5 Oct**, that is the top-priority problem regardless of what
else is unfinished. Hackathon projects lose because the video was recorded at 2am on deadline
day, not because the code was bad.

---

## Cross-cutting

### Daily ritual — 15 minutes, every day

Three questions: what landed, what is blocked, is the current gate still reachable. The third
one is the point. A gate that becomes unreachable on the 25th is recoverable; the same fact
discovered on the 3rd is not.

### Cut valves, in order

When you are behind, cut in this order and **cut early** — a cut made on the 1st buys three
days, the same cut made on the 4th buys none.

1. **F6 audit export** (P3-B5, P3-A4) — the largest single reclaim, ~2.5 days
2. **Reminders** in F3 — keep status, drop the nudges
3. **P3-A5 hardening** — accept rougher error paths, but never a panic in the demo path
4. **P0-A5** `zcash-sign` study — useful, not required
5. **Degraded demo** per R1 — the last valve, and a decision rather than a slip

### Never cut

The clean-environment rehearsal, the demo recording window, and the security-posture review.
These are what the judges actually experience.

### If you fall behind

Dev A's estimates total ~20 working days against a 24-day window — **83% utilisation with no
slack for learning Rust at the protocol level.** For a team whose stated weak spot is exactly
that, expect to be behind at some point. That is planned for, not a failure.

The response is always the same: pull a cut valve, do not extend hours. A tired team on 9
October writing custody code is how a project ends up with an overstated security claim in its
submission — the one failure mode that outlives the hackathon.

---

## Phase 5 — The path to actually usable

**Nothing in Phases 0–4 makes this safe for real funds**, and the submission must say so
plainly. This is what stands between the demo and a product a foundation could hold ZEC in.

### Blocked on upstream — not ours to fix

| Blocker | Status |
|---|---|
| `frost-rerandomized` is not covered by the NCC audit | Upstream. Until it is audited, no responsible mainnet deployment |
| ZIP-312 is still Draft | ZF's 2026 roadmap commits to finalising it |
| PCZT v2 + Ironwood on release candidates | librustzcash #2467, #2525 |

### Ours to build — roughly sequenced

| Stage | Work | Rough effort |
|---|---|---|
| **5.1 — Recoverable** | Surface the **Repairable Threshold Scheme** (lost-share recovery) and **Refresh Share** (signer rotation, participant removal). Both are already implemented upstream; we chose not to surface them for the hackathon. A custody tool without share recovery is a trap. | 3–4 weeks |
| **5.2 — Reviewable** | Independent security review of *our integration* — the audit of `frost-core` says nothing about how we use it. Threat model, key-ceremony documentation an auditor will accept, share-handling procedures. | 4–6 weeks + review lead time |
| **5.3 — Operable** | Air-gapped signing via the Blockchain Commons standalone-signer pattern. Hardware wallet support. Monitoring and incident response. Multiple vaults, roles, tiered quorum policies. | 6–8 weeks |
| **5.4 — Mainnet** | Everything above, plus legal review of the coordination-service posture (see [01-strategy.md](01-strategy.md) §7), plus a staged rollout starting with amounts nobody minds losing. | Gated on 5.1–5.3 |

**Realistic horizon: 3–6 months to something a foundation could hold real funds in**, and the
date is not fully ours — 5.4 cannot responsibly precede an audit of `frost-rerandomized`.

Say this in the submission. A team that can state precisely why its custody product is not yet
safe for real money reads as competent to a room full of cryptographers. A team that glosses
over it reads as dangerous, and that impression does not wash off.
