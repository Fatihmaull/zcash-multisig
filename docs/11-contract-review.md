# 11 — Integration contract review

**Roadmap task Y3 / P2-B1.** Subject: `apps/web/src/types/coordinator.ts`.

The contract was written by Dev B alone; P2-B1 called for it to be agreed jointly. It is
structurally sound — structured errors rather than strings, a `CoordinatorService` interface
both mock and real implement, `culprits` tracked as a vector. Never a rewrite.

**Five of the seven gaps are now closed in code.** Two remain, because they change the shape of
the system rather than its naming, and imposing them on someone else's design without asking is
not a decision one developer should make alone. Concrete diffs are proposed below — the meeting
is now about agreeing to two changes, not discovering seven.

Delete this file once §1 and §2 are decided and applied.

---

## ✅ Closed — no discussion needed

| # | Gap | Resolution |
|---|---|---|
| 3 | `Date` would not survive the wire | All timestamps are **ISO 8601 strings**. A `Date` serialises to a string over HTTP anyway; typing it as `Date` let the mock return real Dates while the real coordinator returns strings, with TypeScript blind to the difference. Mock updated to match. |
| 4 | Nothing carried the randomizer | Added `randomizerSeedHex` to `ApprovalRequestState`, documented as bound to one round and required to re-derive `RandomizedParams` for after-the-fact verification. Without it the audit trail cannot be independently checked. |
| 5 | `culprit` and `culprits` both existed | `culprits: string[]` only. Two fields meant the singular would eventually be read and a second culprit dropped silently. Mock's two call sites updated. |
| 6 | `ANCHOR_STALE` contradicted its own comment | Kept, with the real trigger written down: deferring the anchor to broadcast removes the *common* cause, not every cause — a reorg between selection and submission, or a block falling outside the node's anchor retention window, still produces it. Recoverable by re-anchoring; collected signatures stay valid. |
| 7 | Status is poll-only | Documented as a deliberate limit on `CoordinatorService`, with a warning not to write UI that would need rewriting to accept pushed updates. No action this build. |

Also fixed in passing: the mock generated a mainnet-range `anchorBlock` (3.5M) in a testnet-only
build. Now in the testnet Ironwood range.

---

## 🔴 1. Signing is modelled as one round; FROST has two

```ts
signApproval(approvalId, participantId): Promise<SignRoundUpdate>
```

Round 1 (commitments) and round 2 (signature shares) are separate network trips, and round 2
cannot begin until the coordinator holds threshold commitments *and* has derived the randomizer
seed from them. A single call cannot express that ordering, and Dev A hits it on day one of
P1-A2.

**Proposed:**

```ts
// Round 1 — the participant commits. Returns once recorded; the round may
// still be waiting on other signers.
submitCommitment(
  approvalId: string,
  participantId: string,
  commitmentHex: string,
): Promise<SignRoundUpdate>;

// Available only once threshold commitments are in. Carries the signing
// package and the randomizer seed the participant needs to regenerate
// RandomizedParams locally (constraint C6).
getSigningPackage(
  approvalId: string,
  participantId: string,
): Promise<{ signingPackageHex: string; randomizerSeedHex: string }>;

// Round 2.
submitSignatureShare(
  approvalId: string,
  participantId: string,
  shareHex: string,
): Promise<SignRoundUpdate>;
```

Plus a state machine that rejects out-of-order submission rather than accepting it and failing
at aggregation.

**Alternative** if three methods feels heavy: keep one call with an explicit
`round: 1 | 2` parameter. Cheaper to write, but the payload differs per round, so the types end
up as a union anyway — and `getSigningPackage` is still needed regardless.

## 🔴 2. The contract does not separate the browser from the signer

`signApproval(approvalId, participantId)` is consumed by the web app and reads as something the
browser calls. But the share lives in `quorum-signer` on the participant's own machine and
**never in the browser** ([03-architecture.md](03-architecture.md) §2).

If the browser can trigger a signature with nothing but a participant id, then either the share
is in the browser — violating the core invariant — or the call is a no-op needing a second,
undocumented channel. Either way the trust boundary has quietly moved, and this is a naming
problem only on the surface.

**Proposed — two interfaces, not one:**

```ts
/**
 * Web app → coordinator. Reads state, creates requests, watches progress.
 * NEVER signs. Nothing here touches key material.
 */
export interface CoordinatorService {
  createDkgSession(request: DkgSessionRequest): Promise<DkgSessionState>;
  getDkgStatus(sessionId: string): Promise<DkgSessionState>;
  completeDkg(sessionId: string): Promise<DkgSessionResult>;
  submitApproval(submission: ApprovalSubmission): Promise<ApprovalRequestState>;
  getApprovalStatus(approvalId: string): Promise<ApprovalRequestState>;
}

/**
 * Signer binary → coordinator, over frostd. Authenticated as the
 * participant; this is the only surface that produces signatures.
 */
export interface SignerService {
  fetchPendingRequests(participantId: string): Promise<ApprovalRequestState[]>;
  submitCommitment(/* as §1 */): Promise<SignRoundUpdate>;
  getSigningPackage(/* as §1 */): Promise<{ signingPackageHex: string; randomizerSeedHex: string }>;
  submitSignatureShare(/* as §1 */): Promise<SignRoundUpdate>;
  declineApproval(approvalId: string, participantId: string): Promise<ApprovalRequestState>;
}
```

The browser can then show a signer's status but is structurally incapable of acting as them —
enforced by the type system rather than by everyone remembering.

**Consequence for the UI:** the approve button in `ApprovalDetailView` cannot itself sign. It
either instructs the user to approve in their signer app, or a local signer agent exposes a
loopback endpoint the browser can poke. That is a product decision, and it belongs in this same
conversation.

---

## Output

For §1 and §2: a decision, applied to `types/coordinator.ts` and the mock in the same session.
Then Dev A starts P1-A1 against a contract both developers agreed to, and the mock stays a
faithful stand-in rather than a divergent one.
