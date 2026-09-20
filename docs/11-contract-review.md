# 11 — Integration contract: decision record

**P2-B1 / Y3 — closed 20 September 2026.** All seven gaps resolved and applied to
`apps/web/src/types/coordinator.ts`, the mock, and the API route.

This was an agenda; it is now a record. Kept so the reasoning survives the diff — delete it
once rafzhka has read it.

---

## §1 — Signing split into two rounds, per action

**Was:** `signApproval(approvalId, participantId)` — one call.

**Now:** `submitCommitments()` → `getSigningPackages()` → `submitSignatureShares()`, each taking
and returning arrays.

Two reasons one call could not work.

**The protocol.** Round 2 cannot begin until the coordinator holds threshold commitments from
*every* participating signer, which have not arrived when the first signer calls. A single
method would have to block on other people.

**The nonces.** Round-1 nonces stay on the signer's machine between rounds and **must never be
reused** — the same nonce across two signing packages leaks the secret key. One method hides
where that state lives, and hidden state is the state that leaks.

**Arrays, because one FROST round is needed per spend action.** A transaction with N shielded
inputs needs N complete rounds, each with its own randomizer, all over the same sighash. This
was discovered while writing [13-phase-1-plan.md](13-phase-1-plan.md) and is *not* in the
original review — the first proposal used single values and was wrong.

Added types: `ShieldedPool`, `SigningAction` (pool, index, alphaHex), `SigningPackages`.

Two traps are written into the type docs so they survive:

- **The randomizer comes from the PCZT, not FROST.** `RandomizedParams::from_randomizer()`,
  never `new_from_commitments()` — that guidance is for generic FROST where the signer chooses
  the randomizer.
- **An empty action list is a failure, not "nothing to do."** Querying the wrong bundle of a v6
  transaction returns success with zero spends.

## §2 — `CoordinatorService` split from `SignerService`

**Was:** one interface, with `signApproval` reachable from the browser.

**Now:** two.

`CoordinatorService` — browser to coordinator. Reads state, creates requests, watches progress.
**No signing methods at all; the omission is the point.**

`SignerService` — signer binary to coordinator over `frostd`, authenticated as the participant.
The only surface that produces signatures.

The old shape let a browser call produce a signature from nothing but a participant id. That
can only mean one of two things: the share is in the browser, violating the core invariant, or
the call is a lie backed by an undocumented second channel. Splitting the interfaces makes the
browser *structurally* incapable of signing — enforced by the type system rather than by
everyone remembering.

**Product consequence, and it is the part worth arguing about.** The approve button in
`ApprovalDetailView` cannot sign. The participant approves in their own signer application;
the browser shows status. That reads as worse UX — two surfaces instead of one.

**It is the better demo.** A video that cuts from the treasurer's browser to the signer, and
back to a confirmed transaction, *shows* the zero-custody property rather than asserting it. A
single seamless screen hides the one thing that distinguishes Quorum from a wallet.

A local loopback endpoint (signer listens on localhost, browser calls it) stays available if
the UX becomes genuinely obstructive — but it adds attack surface to a custody product, so not
before it is needed.

## §3–§7 — closed earlier

| # | Resolution |
|---|---|
| 3 | Timestamps are **ISO 8601 strings**, never `Date`. A `Date` serialises to a string over HTTP anyway; typing it as `Date` let the mock and the real coordinator diverge invisibly. |
| 4 | `randomizerSeedHex` added to `ApprovalRequestState` — required to re-derive `RandomizedParams` and re-verify a round afterwards. Without it the audit trail cannot be checked independently. |
| 5 | Duplicate singular `culprit` removed; `culprits: string[]` only. |
| 6 | `ANCHOR_STALE` kept with its real trigger: a reorg between anchor selection and submission, or a block outside the node's retention window. Deferring the anchor removes the common cause, not every cause. |
| 7 | Poll-only status documented as a deliberate limit, with a warning not to write UI that would need rewriting to accept pushed updates. |

## Not done, deliberately

The mock now satisfies `SignerService`, and the API route exposes `signer/*` endpoints **only
because there is no signer process yet**. In production those endpoints do not exist on the web
tier at all. The route header says so; do not let it quietly become permanent.
