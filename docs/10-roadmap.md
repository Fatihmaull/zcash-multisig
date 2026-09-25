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
| ~~**P0-B3**~~ | ✅ **DONE 22 Sep.** Source wallet address funded and shielded directly into Ironwood pool via `zcash-devtool` (`utest1quqhwz...`, verified 0.10000000 TAZ spendable at block height 4,379,870). | 0.5d | — |
| ~~**P0-B4**~~ | ✅ **DONE** (PR #1). `prisma/schema.prisma` — vaults, participants, approval requests, round events, viewing keys. Zero key material, verified in review. | — | — |
| ~~**P0-B5**~~ | ✅ **DONE 22 Sep.** 10 contacts listed, 3 outreach email templates finalized, technical question dispatched to ZF, and Zcash Community Forum build thread drafted and published. See [14-traction-kickoff.md](14-traction-kickoff.md). | 0.5d + ongoing | — |

### 🚩 Gate A — 21 Sep

- [x] `frost-zcash-demo` runs with `-C redpallas` — `trusted-dealer` verified, `frostd` redpallas router test and the frost-client suite pass. Caveat recorded: the standalone `coordinator` binary is CLI-transport only. [12-spike-s1-report.md](12-spike-s1-report.md) §6
- [x] Written verdict on PCZT v2 + Ironwood feasibility — [12-spike-s1-report.md](12-spike-s1-report.md) §8. Supported; anchor deferral moved to Phase 1
- [x] `frostd` channel guarantees documented — TLS plus Noise_K participant-to-participant, [03-architecture.md](03-architecture.md) §2
- [x] Node access working, past testnet Ironwood activation height — `testnet.zec.rocks:443`, verified 19 Sep
- [x] Funded testnet wallet with Ironwood-pool ZEC — **verified 0.10000000 TAZ spendable in Ironwood** via `zcash-devtool` at height 4,379,870. See [15-testnet-wallet-guide.md](15-testnet-wallet-guide.md)
- [x] Repo scaffolded, CI green — three jobs, plus guards that fail the build on a forbidden ciphersuite (C4) or a mainnet reference (C9)
- [x] Outreach started, ZF question sent — **templates and thread published** in [14-traction-kickoff.md](14-traction-kickoff.md)

**If Gate A fails:** stop all feature work; both devs onto the spike. This gate cannot slip past
**22 Sep** without triggering the R1 fallback conversation early.

---

## Phase 1 — Threshold core · 22–27 Sep

> Day-by-day execution detail, the design decisions S1 settled, and the Gate B decision points
> are in [13-phase-1-plan.md](13-phase-1-plan.md). Read it before starting P1-A1.

**Goal:** a 2-of-3 shielded **Ironwood** spend confirms on testnet. **CLI only — no UI.**

This phase is the whole project. Everything after it is user interface.

### Dev A

| ID | Task | Est | Depends on |
|---|---|---|---|
| ~~**P1-A1**~~ | ✅ **DONE 21 Sep** (#11). DKG as a typestate plus the full `frostd` transport — XEdDSA login, sessions, Noise_K end to end. Our own client, because `frost-client` is unpublished and pinned to frost-core 2.2.0. | — | — |
| ~~**P1-A2**~~ | ✅ **DONE 21 Sep** (#11). `quorum-signer`. `sign()` consumes the session, so nonce reuse — the one mistake that leaks the signing share — is a compile error. Share at rest behind Argon2id + XChaCha20-Poly1305. | — | — |
| ~~**P1-A3**~~ | ✅ **DONE 21 Sep** (#11). `quorum-coordinator`. Unit of work is an **action**, not a transaction. Culprit attribution carried in the error type, not flattened to a message. | — | — |
| ~~**P1-A4**~~ | ✅ **DONE 23 Sep** (#29) — **Gate B, four days early.** A 2-of-3 threshold-signed shielded **Ironwood** spend confirmed on testnet: txid `0ef1e96411b770fb0aec7d35c820510cd303f696126ac85782158c75382681ce`, block 4,383,363. `pczt_job.rs` reads the sighash and every unsigned spend's `(pool, index, alpha)`, and writes 64-byte RedPallas signatures back. Not via `pczt::roles::signer` — that wants a `SpendAuthorizingKey`, one secret that authorizes the spend, and no such key exists in a vault. `low_level_signer::sign_ironwood_with` is the only public door. | — | — |

### Dev B — Phase 1 share

Dev B owns everything touching the node, because Dev B owns the infrastructure. This keeps Dev A
on cryptography rather than plumbing.

| ID | Task | Est | Depends on |
|---|---|---|---|
| ~~**P1-B1**~~ | ✅ **DONE 22 Sep.** Endpoint verification script (`pnpm node:verify`), `zcash-node.ts` client, and live note scanning integration via `zcash_client_backend` / `zcash-devtool` (`src/lib/onchain-balance.ts`), scanning Ironwood spendable balance (0.10000000 TAZ at height 4,379,870). | 1d | Gate A |
| ~~**P1-B2**~~ | ✅ **DONE 22 Sep.** Broadcast API route (`/api/broadcast`) with `SendTransaction`, `GetTreeState` anchor retrieval, and live confirmation tracking via `getTransactionStatus` connected to lightwalletd. | 1d | P0-B1 |
| **P1-B3** | ✅ **DONE 22 Sep.** `pnpm fixture:reset` — one-command reset that clears and re-seeds both local Prisma DB and Supabase with Foundation Treasury vault, 3 participants, and a pending 2.5 TAZ proposal to the real testnet recipient address. | 0.5d | P0-B3 |

### 🚩 Gate B — ✅ **PASSED 23 Sep**, four days early

- [x] A shielded **Ironwood** spend is threshold-signed and **confirms on testnet** — txid
      `0ef1e96411b770fb0aec7d35c820510cd303f696126ac85782158c75382681ce`, block 4,383,363
- [x] An invalid share is detected and the culprit identified, as a typed error —
      `InvalidSignatureShare::culprits`, surfaced by name across real processes (P3-A2)
- [x] No share material has ever crossed into the coordinator process — three OS processes,
      one sealed share each, `./scripts/three-signer-demo.sh` (P3-A1)
- [x] The scenario can be reset and re-run from the fixture
- [x] **2-of-3 DKG completes over `frostd` with three separate signer processes** — ✅ **25 Sep**
      (P3-A6). `./scripts/three-party-ceremony.sh` runs three `quorum-dkgd` processes against a
      real `frostd`; all three derive the same address and each writes only its own share.

**All five met.** Both sentences are now ours to say: *no party sees more than one share while
signing*, and *no party ever saw more than one share*. Until 25 Sep only the first was true, and
the difference is the whole security claim.

> ✅ **And now true of the same vault** (P4-0, 25 Sep). The vault built by
> `three-party-ceremony.sh` — three processes, one share each, over a real `frostd` — spent
> shielded Ironwood funds on testnet: txid
> `259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61`, block 4,390,493.
>
> **This is the txid the submission should lead with**, not the 23 Sep one. Both are real
> threshold-signed Ironwood spends; only this one comes from a vault whose shares were never in
> the same process. `0ef1e964…` stays on record as the first, which is what made the 27 Sep gate
> four days early.

**If Gate B had failed:** the degraded demo in [06-risk-register.md](06-risk-register.md) R1.
Kept here because R1 still governs if the distributed ceremony does not land by Gate C.

---

## Phase 2 — Product shell · 22–29 Sep *(Dev B, parallel)*

**Goal:** the interface is ready to connect the moment the core works.

| ID | Task | Est | Depends on |
|---|---|---|---|
| ~~**P2-B1**~~ | ✅ **DONE 20 Sep.** All seven gaps closed. Signing split into two rounds taking per-action arrays; `CoordinatorService` split from `SignerService` so the browser is structurally incapable of signing. Decision record in [11-contract-review.md](11-contract-review.md). | — | — |
| ~~**P2-B2**~~ | ✅ **DONE** (PR #1). Next.js + Tailwind scaffold, layout, navigation. | — | — |
| **P2-B3** | ✅ **DONE 22 Sep.** Prisma migrations created (`0_init`), applied and deployed cleanly. `pnpm db:migrate` and `pnpm db:deploy` added. Verified against PostgreSQL with seed execution. | — | — |
| ~~**P2-B4**~~ | ✅ **DONE** (PR #1). `src/lib/mock-coordinator.ts`, clearly labelled, implements `CoordinatorService`. | — | — |
| ~~**P2-B5**~~ | ✅ **DONE** (PR #1). Vault creation and list UI. | — | — |
| ~~**P2-B6**~~ | ✅ **DONE** (PR #1). Approval list and detail UI. | — | — |

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
| ~~**P3-A1**~~ | ✅ **DONE 24 Sep.** `quorum-coordinatord` serves the integration contract on `:2745`, and `quorum-signerd` is a separate process per share. **Three OS processes, one share each** — run `./scripts/three-signer-demo.sh`. Signer routes require a per-participant bearer token: without it `participantId` is a claim, and the event log would name the wrong person. | — | — |
| ~~**P3-A2**~~ | ✅ **DONE 24 Sep.** Attributed by name, across real processes. `QUORUM_SIGNER_MISBEHAVE=1` makes a signer sign under the wrong randomizer — reproducible, which recording a demo requires. Note FROST refuses the easy forgery: signing from a second session fails locally with *the participant's commitment is incorrect*. | — | — |
| ~~**P3-A3**~~ | ✅ **DONE 24 Sep.** A signer past the deadline is marked `TIMEOUT`, with `culpritDetected: false` and a message that reassures. A timeout does not abort the request — the commonest real failure of shared control is someone on a plane, not malice. | — | — |
| ~~**P3-A4**~~ | ✅ **DONE 24 Sep.** `/coordinator/vault/audit` exports the vault's **unified full viewing key** alongside the event log, and refuses a seed that does not reproduce the vault. The viewing key is the point: an event log is a table we control, the chain is not. | — | — |
| ~~**P3-A5**~~ | ✅ **DONE 24 Sep.** No panic path reaches a handler — map indexing replaced with checked lookups, and a poisoned lock returns a typed error saying state may be inconsistent and nothing was signed, rather than taking the service down. | — | — |
| ~~**P3-A6**~~ | ✅ **DONE 25 Sep.** `quorum-dkgd` — one process per participant, DKG over a real `frostd`. Round 2 is sealed per recipient with `Noise_K`, so the relay carries ciphertext only; a test asserts exactly that. Sender identity comes from the key that decrypted the message, never a field inside it. Added a **confirmation round** the single-process fixture never needed: everyone compares the group key and the derived address and aborts if they differ, because a seed contributor who equivocates produces three vaults wearing one name and FROST raises no objection. `MISBEHAVE_SEED=1` reproduces that. | A | 1d |
| ~~**P3-A7**~~ | ✅ **DONE 25 Sep**, unplanned. **The coordinator now checks a PCZT belongs to this vault.** It did not, and the three-process demo had been reporting `APPROVED, 2 signatures` for a transaction built by a different vault — real quorum, real shares, authorizing nothing. Each action carries `rk`, which must equal this vault's `ak` randomized by the action's own `alpha`; both are public, so the check is free. Refused at submission, before any signer burns a nonce. `examples/which_vault.rs` answers the question before a recording starts. | A | — |

### Dev B

| ID | Task | Est | Depends on |
|---|---|---|---|
| ~~**P3-B1**~~ | ✅ **DONE 25 Sep.** **Live coordinator client adapter & zero-custody contract wiring.** Rewired `coordinator-client.ts` to live `quorum-coordinatord` routes (`/coordinator/vault/register`, `/coordinator/vault/list`, `/coordinator/vault/audit`, `/coordinator/approval/submit`, `/coordinator/approval/status`, `/health`). Removed `/v1/*` 404 paths. The sign route (`/api/approvals/[id]/sign`) now enforces zero-custody by synchronizing verified signer states from the coordinator (eliminating arbitrary client-forged rows / fallback `"Bob"`). `/api/vaults/[id]/ceremony` strictly verifies Zcash testnet unified addresses (`utest1...`) and registers vaults with the live coordinator daemon. Verified with automated end-to-end integration test (`pnpm coordinator:verify`). | 1d | P3-A1 |
| ~~**P3-B2**~~ | ✅ **DONE 22 Sep.** **F1 — guided key ceremony.** Interactive 3-step DKG wizard (`KeyCeremonyView.tsx`), participant configuration, latency ping simulation, clear key custody guardrails, and persistent vault creation (`/api/vaults/create`). | 2d | P3-B1 |
| ~~**P3-B3**~~ | ✅ **DONE 22 Sep.** **F3 — signer coordination.** Circular SVG Quorum Indicator, status per signer (Alice, Bob, Carol Standby), simulated timeout / non-responding recovery path, and real-time state updates. | 1.5d | P3-B1 |
| ~~**P3-B4**~~ | ✅ **DONE 22 Sep.** **F4 — misbehaving-signer UI.** Dedicated `MisbehaviorAlert.tsx` with clear cryptographic rejection context, "Funds 100% Secure" guarantee, culprit exclusion flow, and fail-safe recovery to standby signer. | 1d | P3-A2 |
| ~~**P3-B5**~~ | ✅ **DONE 22 Sep.** **F6 — viewing-key audit export.** API endpoint (`/api/vaults/[id]/audit-export`) and UI dropdown supporting CSV and JSON exports, with encrypted viewing-key fingerprint and live on-chain balance reconciliation. | 1d | P3-A4 |
| ~~**P3-B6**~~ | ✅ **DONE 22 Sep.** Drafted the submission text in [submission-draft.md](submission-draft.md) with full problem/solution, architecture diagram, 5-step demo proof, and honest security posture per R6 / Phase 5. | 0.5d | — |

### 🚩 Gate C — 4 Oct · **Feature freeze**

- [ ] Three people complete a 2-of-3 DKG through the web UI without reading FROST docs
- [ ] An approval request is created, approved by two of three, and confirms on testnet
- [ ] A corrupted share produces a plain-language event naming the participant
- [x] Audit trail exports and reconciles against viewing-key-derived on-chain history *(or is formally cut)*
- [x] Submission text drafted

**After 4 Oct: bug fixes and demo only.** No new features, no refactors, no "quick
improvements". Every hackathon team breaks this rule and most of them regret it.

---

## Phase 4 — Ship · 5–10 Oct

**Goal:** a recorded demo and a submitted project, with buffer left over.

| ID | Task | Owner | Est |
|---|---|---|---|
| ~~**P4-0**~~ | ✅ **DONE 25 Sep.** **One vault, both claims.** Ceremony vault funded (0.1 TAZ, Ironwood), PCZT built against its own watch-only wallet, signed by three `quorum-signerd` processes, proved, broadcast, mined: txid `259242c6d3c518224627e6b7b7488191d4cbbb32dfd84c2e09e144f9410b3a61`, block 4,390,493. Needed a new route — `/coordinator/approval/authorized` — because the coordinator was collecting signatures with no way to hand back what they authorize, so the end-to-end flow could not finish through the service at all. | A | — |
| ~~**P4-1**~~ | ✅ **DONE 25 Sep.** Fresh clone, cold build, full chain re-run. Cold Rust build 52 s, `pnpm install` 6 s, ceremony clean — **nothing was broken by a clean machine.** What was missing was the map: the working sequence existed only in PR descriptions, so a fresh clone gave you a stale README claiming "no application code yet" and a Quickstart covering only the mocked web tier. Written up as [16-runbook.md](16-runbook.md), every command verified that day. The long pole is the faucet, not the code — fund the vault before sitting down to record. | Both | 1d |
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
