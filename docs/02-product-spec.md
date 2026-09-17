# 02 — Product specification

---

## 1. Problem

Zcash shielded pools have **no multisig opcode**. There is no protocol-level way to express
"two of these three people must agree before this moves."

An organisation holding ZEC today therefore picks one of two bad options:

- **Use a transparent address** — every balance and transfer is public forever, which discards
  the entire reason to hold ZEC rather than any other asset.
- **Let one person hold the seed** — a single point of failure, theft, coercion, and bus factor.
  In control-audit terms it is not a control at all; it is an unmitigated key-person risk with a
  human wrapper.

~4.89M ZEC (28.9% of supply, ~$5.8B as of September 2026) sits in shielded pools under exactly
this constraint.

The cryptography to fix it exists. FROST threshold signatures with the RedPallas ciphersuite
produce RedDSA signatures valid as Zcash spend authorizations. `frost-core` v3.0.0 is stable and
audited by NCC Group. What does not exist is anything a non-cryptographer can operate: the key
ceremony is a CLI that copy-pastes JSON between terminals, there is no approval workflow, no
signer status, no way to tell a treasurer *why* a signature failed, and no record they can hand
an auditor.

## 2. Solution

An orchestration layer over re-randomized FROST:

- **Guided key ceremony** — 2-of-3 distributed key generation a non-cryptographer can complete.
- **Approval requests** — propose a shielded transaction, collect threshold approval.
- **Signer coordination** — request, status, reminders, and an honest state for a signer who
  simply does not respond.
- **Cryptographically enforced quorum** — not an application-level permission check. The
  transaction is unsignable below threshold because the mathematics says so.
- **Misbehaving-signer handling** — an invalid share is surfaced as a human-readable event
  naming the participant, not a Rust panic.
- **Viewing-key-backed audit trail** — exportable, verifiable by a third party.

**Non-custodial by design.** Key shares never touch our server. See
[03-architecture.md](03-architecture.md) §2.

## 3. Primary user

A **treasurer or operations lead at a Zcash-holding organisation** — foundation, grant
recipient, treasury vehicle — who is accountable for funds they cannot currently control safely
or account for credibly.

They are competent and non-cryptographic. They know what a control is, what an auditor will ask
for, and what happens when a board asks where the money went. They do not know what a
ciphersuite is and should never need to.

**Their two problems are one problem.** They need shared control *and* they need to prove
correct handling to someone else. A product that solves only the first leaves them unable to
answer the question that actually gets asked.

## 4. Core flows

### F1 — Key ceremony (2-of-3 DKG)

Organiser creates a vault, names three participants, sets threshold 2. Each participant joins
over an **authenticated and confidential** channel and runs DKG. No participant, and no server,
ever holds the full spending key. Output: three shares held locally by three people, one shared
public key, one Zcash shielded address.

The UI must make the security-critical moments legible: what a share is, why it must not be
copied to a colleague, what happens if it is lost.

### F2 — Approval request

A proposer builds a shielded spend — recipient, amount, memo, reason. The system produces a PCZT
and an approval request. Signers see what they are approving in plain language before anything
cryptographic happens.

### F3 — Signer coordination

Request dispatched, status tracked per signer: pending, approved, declined, unreachable.
Reminders. A **non-responding signer is a first-class state**, not an error — the most common
real-world failure of shared control is not malice, it is someone on a plane.

### F4 — Misbehaving-signer detection

A participant returns an invalid signature share. `frost-core` v3.x reports this via
`InvalidSignatureShare::culprits` (a vector in v3 — it was `culprit`, singular, before the
rerandomized API rework). We surface it as:

> **Signature share rejected — Budi Santoso.** The share returned does not verify against the
> commitment made in round 1. This vault has not been charged and no funds moved. Re-run the
> round without this signer, or investigate the device.

Not a stack trace. Not "InvalidSignatureShare". The treasurer must learn what happened, what it
cost, and what to do next.

### F5 — Aggregation, broadcast, confirmation

Threshold reached → aggregate shares into a single RedDSA signature → assemble the final
transaction → broadcast → track to confirmation. Under v6 the anchor is chosen at broadcast
time, so a slow approval round does not invalidate collected signatures. See
[04-technical-constraints.md](04-technical-constraints.md) §3.

### F6 — Audit trail export

Exportable record of every approval, every signer action, and — crucially — the on-chain
transaction history **derived from the vault's viewing key**, not from our database. Export as
CSV and JSON. A recipient given the viewing key can verify the export independently.

## 5. Scope

### In scope

F1 through F6, for **one flow end to end**. 2-of-3 only. Testnet only. Ironwood pool only.

### Out of scope — do not build these

| Excluded | Why |
|---|---|
| Wallet features — portfolio, balances, prices, quick send | Not our product. Wallets exist and are better at this. |
| Multi-chain anything | Dilutes the track pitch to zero. |
| Tiered / dynamic quorum policies | Real feature, real value, wrong month. |
| Hardware wallet integration | The Blockchain Commons standalone signer is the right architectural pattern for later; integrating it now costs the demo. |
| Mainnet support | Non-negotiable. See [04](04-technical-constraints.md) §9. |
| Signer rotation and share repair | The libraries already implement Refresh Share and the Repairable Threshold Scheme. We are not surfacing them in this build. Mention as roadmap; the implementation exists, which makes it a credible roadmap claim rather than a wish. |

### The one scope change from the original brief

The original brief put **viewing-key auditor reports out of scope** as roadmap, and specified
the audit trail as an application event log.

**Changed: the audit trail is viewing-key-backed.**

Rationale — an application event log is a database table. It proves nothing to anyone who does
not already trust us, which for an audit artifact is the whole population that matters. A
viewing-key-derived record is cryptographic evidence verifiable independently. The difference
is the difference between a demo and a product, and it is the half of the problem that the
founder's GRC background uniquely qualifies them to see.

**Honest cost:** 2–3 days on top of infrastructure already required, since building shielded
transactions already means scanning with `zcash_client_backend`. This is an addition, not a free
swap. It is paid for by keeping signer rotation and share repair out of the build, and by
folding reminders and non-responding-signer handling into the status UI rather than treating
them as separate features.

**If Gate B is at risk on 27 Sept, F6 is the first thing cut.** A working shielded spend with a
plain event log beats a beautiful audit export with no transaction.

## 6. Definition of done

The build is done when, on testnet, from a clean environment:

1. Three people complete a 2-of-3 DKG through the web UI without reading FROST documentation.
2. A proposer creates an approval request for a shielded Ironwood spend.
3. Two of three signers approve; the transaction confirms on testnet.
4. In a second run, one signer returns a corrupted share and the UI names them in plain
   language while the vault remains safe.
5. The audit trail exports and reconciles against the on-chain history derived from the
   viewing key.
6. All five steps are recorded on video before 10 October.

Step 6 is part of the definition of done, not a follow-up task.
