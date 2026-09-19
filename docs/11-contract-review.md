# 11 — Integration contract review

**Roadmap task Y3 / P2-B1.** Must happen **before Dev A starts P1-A1 on 22 Sep**.

Subject: `apps/web/src/types/coordinator.ts`. It was written by Dev B alone; P2-B1 called for it
to be agreed jointly. The contract is sound in structure — structured errors rather than strings,
a `CoordinatorService` interface both mock and real implement, `culprits` tracked as a vector.
This is not a rewrite. It is a 30-minute session to close seven specific gaps.

Delete this file once the decisions are recorded in the contract itself.

---

## 🔴 1. Signing is modelled as one round; FROST has two

```ts
signApproval(approvalId, participantId): Promise<SignRoundUpdate>
```

FROST round 1 (commitments) and round 2 (signature shares) are separate network trips, and
round 2 cannot begin until the coordinator holds threshold commitments. A single call cannot
express that ordering.

**Decide:** split into `submitCommitment()` and `submitSignatureShare()`, or keep one call with
an explicit `round` parameter and a state machine that rejects out-of-order submissions.

Dev A hits this on day one of P1-A2. Resolving it after the fact means reworking the mock, the
UI, and the coordinator together.

## 🔴 2. Who actually calls `signApproval`?

The share lives in `quorum-signer`, on the participant's own machine, and **never in the
browser** ([03-architecture.md](03-architecture.md) §2). But the contract is consumed by the web
app, and `signApproval(approvalId, participantId)` reads as something the browser calls.

If the browser can trigger a signature with nothing but a participant id, either the share is in
the browser — violating the core invariant — or the call is a no-op that needs a second,
undocumented channel to the signer binary.

**Decide:** the contract needs two distinct surfaces.

- **Web → coordinator:** read state, create requests, watch status. Never signs.
- **Signer binary → coordinator:** submit commitments and shares. Authenticated as the
  participant, over `frostd`.

Getting this wrong is not a naming problem; it silently relocates the trust boundary.

## 🟠 3. `Date` will not survive the wire

The interface uses `Date` objects. Over HTTP these serialize to strings — the mock returns real
`Date`s, the real coordinator will return `string`s, and TypeScript will not catch the
difference because the mock satisfies the interface locally.

This is precisely the mock/real divergence the contract exists to prevent, and it will surface
at P3-B1 as a pile of small runtime bugs.

**Decide:** ISO 8601 strings on the wire, parsed at the boundary.

## 🟠 4. Nothing carries the randomizer

FROST v3 requires **all signing parties to contribute randomness**, and `RandomizedParams` must
be reconstructible from a stored seed to re-verify a round later. Nothing in the contract
carries either.

**Decide:** where the randomizer seed lives, who persists it, and whether it appears in the
audit trail.

## 🟡 5. `culprit` and `culprits` both exist

```ts
culprit?: string;
culprits?: string[];
```

v3 made this a vector. Two fields means the singular eventually gets read and a second culprit
silently dropped.

**Decide:** keep `culprits: string[]` only. Remove the singular.

## 🟡 6. `ANCHOR_STALE` contradicts its own comment

The taxonomy includes `ANCHOR_STALE`, commented *"should not happen with deferred anchor"*. The
instinct is right — deferring the anchor to broadcast is exactly what removes this failure. So
either it can still occur and the comment should say when, or it cannot and the code should go.

**Decide:** keep with a precise trigger condition, or remove.

## 🟡 7. Status is poll-only

No subscription or long-poll. Fine for the demo, and not worth building now — but the UI should
not be written in a way that makes adding it later a rewrite.

**Decide:** acknowledge as a known limit; no action this build.

---

## Output

For each item: a decision, applied to `types/coordinator.ts` in the same session. Then Dev A
starts P1-A1 against a contract they have actually agreed to, and the mock stays a faithful
stand-in rather than a divergent one.
