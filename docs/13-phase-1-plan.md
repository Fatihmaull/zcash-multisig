# 13 — Phase 1 execution plan

**22–27 September. Gate B: a 2-of-3 shielded spend, threshold-signed, confirmed on testnet.
CLI only — no UI.**

This phase is the whole project. Everything after it is user interface. The plan below is built
on what spike S1 actually found, not on the reference demo — which is on FROST v2 and cannot be
copied. See [12-spike-s1-report.md](12-spike-s1-report.md).

---

## Preconditions — none of Phase 1 starts cleanly without these

| # | Blocker | Owner | Why it blocks |
|---|---|---|---|
| 1 | ~~`P2-B1` §1–§2 contract decisions~~ | — | ✅ **Closed 20 Sep.** Contract now has two interfaces and a two-round, per-action signing surface. See [11-contract-review.md](11-contract-review.md). |
| 2 | **`P0-B3` funded source wallet** | Dev B | Not the vault — the vault does not exist until P1-A1 produces its address. Fund a *source* wallet now, transfer into the vault on day 3. |
| 3 | **§7 FVK derivation** | Dev B (asked ZF) | On the critical path, not a footnote — see below. |

### The FVK problem is a day-1 decision, not a later one

P1-A1 must produce a **vault address**, or there is nothing to fund and nothing to scan. That
address comes from an Orchard full viewing key derived from the FROST group verifying key — and
the only known constructor is
`FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed()`,
which lives in the `conradoplg/orchard` fork (zcash/orchard#475, still open).

**Recommendation: use the fork, exactly as `frost-zcash-demo` does, and document the caveat
loudly.** Waiting on ZF costs days we do not have, and the fallback if the answer is bad is
already planned (R1: Sapling). Add to `packages/core/Cargo.toml`:

```toml
[patch.crates-io]
orchard = { git = "https://github.com/conradoplg/orchard.git", rev = "42015f15733b95e179189628d6fa34d92b5b3b8b" }
```

Then **write the caveat into the submission text now, not at the end**: funds in a Quorum vault
may not be recoverable under Ironwood's future post-quantum recovery protocol. We do not yet
know whether that is true. Saying so is the whole point.

---

## What S1 settled about the design

Three findings reshape the tasks below. Read them before writing code.

### 1. The randomizer comes from the transaction, not from FROST

`zcash-sign` reads `alpha` **per action** out of the PCZT bundle:

```rust
// for each real spend still awaiting a signature
if action.spend().spend_auth_sig().is_none() {
    if let Some(alpha) = action.spend().alpha() { /* 32-byte Pallas scalar */ }
}
```

So the v3 guidance — *"switch to `sign_with_randomizer_seed()` with a seed from
`RandomizedParams::new_from_commitments()`"* — **does not apply to Zcash**. That guidance is for
generic FROST where the signer chooses the randomizer. Here the transaction dictates it.

The correct v3 path, using only non-deprecated API:

```rust
let params = RandomizedParams::from_randomizer(
    pubkeys.verifying_key(),
    Randomizer::from_scalar(alpha_scalar),
);
let randomized_kp = key_package.randomize(&params)?;          // participant
let share = frost_core::round2::sign(&signing_package, &nonces, &randomized_kp)?;
let sig = frost_rerandomized::aggregate(&signing_package, &shares, &pubkeys, &params)?;
```

**Leave a comment saying why `new_from_commitments` is not used**, or someone will "fix" it
later and silently break spend authorization.

Note this corrects an assumption in `quorum-core/tests/redpallas_v3_smoke.rs`, which uses the
generic path. That test stays — it proves the ciphersuite works — but it is **not** the Zcash
flow. P1-A4 adds a second test that is.

### 2. One signing round per spend action

`collect_randomizers` returns `(action_index, alpha)` for **every** real spend. A transaction
with N shielded inputs needs N complete FROST rounds, each with its own randomizer, all over
the same sighash. Dummy actions are already signed by the IO finaliser at `pczt create`.

Design consequence: the coordinator's unit of work is an **action**, not a transaction. Getting
this wrong shows up as a transaction that signs one input and silently drops the rest.

**Keep Gate B to a single-input spend.** Multi-input is a Phase 3 concern at the earliest.

### 3. A v6 transaction has two shielded bundles, and picking the wrong one is silent

Quoting `zcash-sign` directly:

> A v6 transaction has two such bundles and either may carry spends: a ZIP 318
> Orchard-to-Ironwood migration spends from the *Orchard* pool while its only output is in the
> *Ironwood* pool. The two are reached through different signer entry points, and **asking for
> the wrong one yields no spends rather than an error**.

So the pool must be tracked alongside the action index — `(pool, index, alpha)` — and "zero
spends found" must be treated as a **failure**, never as "nothing to do". Assert a non-empty
result.

---

## Tasks

### Dev A — protocol

| ID | Task | Concretely | Est |
|---|---|---|---|
| **P1-A1** | `quorum-core`: FROST wrapper + DKG | `keys::dkg` part1/2/3 over `frostd`. Output: `KeyPackage` per participant (stays local), `PublicKeyPackage` shared. Then derive `SpendValidatingKey::from_bytes(group_vk)` → FVK (forked orchard) → unified address. **Authenticated *and* confidential channels — C5.** | 1.5d |
| **P1-A2** | `quorum-signer` binary | Holds `KeyPackage`, encrypted at rest with a participant passphrase. `round1::commit`, then `round2::sign` on a key package randomized by the action's alpha. **Never transmits the share** — if a path moves share material across the process boundary, that path is wrong. | 1.5d |
| **P1-A3** | `quorum-coordinator` | Collects commitments, builds `SigningPackage` over the **sighash**, distributes, collects shares, aggregates per action, maps `Error::culprits()` to the typed taxonomy. | 1.5d |
| **P1-A4** | PCZT with an Ironwood bundle | Creator + Constructor roles. Read per-action `(pool, idx, alpha)`. **Defer the anchor to broadcast (C3).** `apply_signature(sighash, sig)` per action. Add the Zcash-flow test. | 1.5d |

### Dev B — node and infrastructure

| ID | Task | Concretely | Est |
|---|---|---|---|
| **P1-B1** | Note scanning | `zcash_client_backend 0.24.0-rc.1` against `testnet.zec.rocks:443`. **First job: confirm its proto matches the endpoint's `CompactTx` field 9 `ironwoodActions`.** If it does not, scanning is blind to Ironwood and Gate B is at risk on day 1. | 1d |
| **P1-B2** | Broadcast + confirmation | `SendTransaction` and `GetTreeState` (for `ironwoodTree`, the anchor source) on the same endpoint — both verified present in S1. | 1d |
| **P1-B3** | Reproducible fixture | Seeded scenario, resettable. You will run this dozens of times; rebuilding state by hand is a tax paid daily until 10 Oct. | 0.5d |

---

## Day by day

**Day 1 — 22 Sep · unblock**
Both: settle `P2-B1` §1–§2 (30 min, first thing). Dev A: patch in the forked orchard, confirm
`SpendValidatingKey` → FVK → address compiles end to end. Dev B: **P1-B1 proto check** — this is
the single highest-value hour of the phase, because a mismatch changes everything downstream.

**Day 2 — 23 Sep · keys exist**
Dev A: P1-A1, DKG completing over `frostd` with three signer processes, producing a vault
address. Dev B: finish P1-B1 scanning.

**Day 3 — 24 Sep · funds exist**
Dev B: transfer from the source wallet into the vault address; confirm the note lands **in the
Ironwood pool**, not Sapling. Dev A: P1-A2 signer binary.

**Day 4 — 25 Sep · the hard day**
Dev A: P1-A4 PCZT assembly with the Ironwood bundle, per-action alpha, deferred anchor. This is
the riskiest task in the project. Dev B: P1-B2 broadcast path.

**Day 5 — 26 Sep · it signs**
Dev A: P1-A3 coordinator, rounds 1 and 2, aggregation, `apply_signature`. Dev B: P1-B3 fixture.

**Day 6 — 27 Sep · it lands**
Both: end to end. A real spend confirms on testnet. 🚩 **Gate B.**

**No UI work this phase.** If Dev B finishes early, the next most valuable thing is the fixture
and a second dry run — not starting Phase 3.

---

## 🚩 Gate B — 27 Sep

- [ ] 2-of-3 DKG completes over `frostd`, three separate signer processes, no share reaching the coordinator
- [ ] A vault address is produced and receives testnet funds **in the Ironwood pool**
- [ ] A shielded spend from that vault is threshold-signed and **confirms on testnet**
- [ ] An invalid share is detected and its signer identified, as a typed error
- [ ] The scenario resets and re-runs from the fixture
- [ ] `cargo test` covers the Zcash flow, not only the generic one

## Decision points

| When | Condition | Action |
|---|---|---|
| Day 1 | `zcash_client_backend` proto does not match field 9 | Stop. Reassess before building on blind scanning. |
| Day 4 | PCZT anchor deferral not implemented (#2525) | Bind the anchor at build time and shorten the approval window for the demo. Note it as a known limitation. |
| **Day 6** | **No confirmed testnet spend** | **Trigger R1 fallback** — [06-risk-register.md](06-risk-register.md). Sapling spend, threshold-signed, with a precise on-camera explanation of what blocks Ironwood, citing the issues by number. A decision, not a reason to spend Phase 3 on the same wall. |

## Standing rules

1. Testnet only. No mainnet funds, at any point, for any reason.
2. Do not chase upstream after 27 Sep. Pinned versions, committed `Cargo.lock`.
3. Every new dependency goes through the workspace table — CI guards the ciphersuite and
   mainnet, not general sloppiness.
4. When the protocol work is confusing, slow down. A confidently wrong cryptographic
   integration is worse than an unfinished one.
