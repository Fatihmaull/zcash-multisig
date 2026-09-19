# 12 — Spike S1 report

**Phase 0 technical output. 19 September 2026.** Covers P0-A1 through P0-A5.

Everything below was executed, not read. Commands and versions are reproducible from
`/tmp` scratch clones of `ZcashFoundation/frost-zcash-demo` and `ZcashFoundation/frost`.

---

## Verdict

**Gate A passes on the technical questions, with one open issue that needs an answer from the
Zcash Foundation before Phase 1 commits to Ironwood.**

Our pinned v3 stack produces a valid rerandomized RedPallas signature and attributes a bad
share to its signer. Two dependency pins were broken and are fixed. PCZT can represent and sign
Ironwood bundles. The unresolved question is how a FROST-controlled vault derives an Orchard
full viewing key in a way compatible with Ironwood's quantum recoverability — see §7.

---

## 1. 🔴 The reference demo is on FROST v2, not v3

`frost-zcash-demo` pins `frost-core 2.2.0`, `frost-rerandomized 2.0.0-rc.0` (locked 2.1.0), and
`reddsa` from a **git revision** rather than crates.io. It also carries a `[patch.crates-io]`
pointing `orchard` at a **fork** (`conradoplg/orchard`) with the `unstable-frost` feature.

We pin v3.0.0. **The demo cannot be copied as a v3 reference** — the rerandomized API changed
between the two, which is precisely the area we depend on.

Consequence for the roadmap: P0-A2's original framing — "get the demo running and follow its
patterns" — is only partly useful. The demo proves the *shape* of the protocol; it does not
show the API we will actually call. This report replaces it as our reference.

## 2. 🔴 Two dependency pins were broken

```toml
zcash_keys = "0.6"      # was
zcash_address = "0.7"   # was
```

`zcash_address 0.7` **does not resolve at all**: it depends on `core2 ^0.3`, and every 0.3.x
release of `core2` is yanked. This was not "outdated", it was unbuildable — it would have
failed on Dev A the moment those crates were first used.

Corrected to `zcash_keys = "0.15"`, `zcash_address = "0.13"` — the versions `frost-zcash-demo`
uses, verified to resolve cleanly alongside `pczt 0.8.0-rc.1` and
`zcash_client_backend 0.24.0-rc.1`.

This is the second latent dependency bug found in two days. Both were invisible to `cargo
check` because nothing imported the crates yet. **Assume more are hiding in the unused half of
the workspace dependency table.**

## 3. ✅ The v3 rerandomized RedPallas path works — proven

Because no upstream artifact demonstrates v3, we wrote the proof ourselves:
`packages/core/quorum-core/tests/redpallas_v3_smoke.rs`, two passing tests.

**`two_of_three_rerandomized_signature_verifies`** — deals 2-of-3, runs both rounds, aggregates,
and verifies the signature **against the randomized verifying key**. That randomized key, not
the group key, is what a Zcash spend authorization is checked against.

**`corrupted_share_is_attributed_to_its_signer`** — substitutes one signer's share for
another's and asserts `Error::culprits()` names the right participant. This is the mechanism
behind product feature F4. If it ever stops naming correctly, the misbehaving-signer UI is
lying, and the test will say so.

These run in the normal `cargo test` suite. Keep them there.

## 4. The v3 API, concretely (P0-A1)

`frost_rerandomized::sign()` is **deprecated**. The current path:

```rust
// Coordinator, after collecting round-1 commitments from every signer:
let (params, randomizer_seed) = RandomizedParams::<C>::new_from_commitments(
    pubkeys.verifying_key(), &commitments, &mut rng,
)?;

// Each participant, in round 2 — regenerates the same randomizer locally:
let share = sign_with_randomizer_seed(
    &signing_package, &nonces[id], &key_packages[id], &randomizer_seed,
)?;

// Coordinator:
let signature = aggregate(&signing_package, &shares, &pubkeys, &params)?;
params.randomized_verifying_key().verify(msg, &signature)?;
```

**Why the change matters.** The randomizer is derived from the seed **plus every participant's
commitments**, and each participant regenerates it rather than being handed one. Upstream's own
comment: participants "don't need to fully trust the Coordinator's random number generator —
even if the randomizer seed was not randomly generated the randomizer will still be."

That is the "all signing parties contribute randomness" property in constraint C6, and it is
load-bearing. **Do not reintroduce a coordinator-supplied randomizer for convenience.**

The randomizer seed must be persisted to re-verify a round later — this is the gap flagged as
item 4 in [11-contract-review.md](11-contract-review.md), and it is real.

## 5. ✅ frostd channel guarantees (P0-A3, constraint C5)

Two independent layers:

| Layer | Mechanism | Protects |
|---|---|---|
| Client ↔ server | **TLS** (rustls). A `--no-tls-very-insecure` flag exists — never use it. | Traffic to `frostd` |
| Participant ↔ participant | **Noise `Noise_K_25519_ChaChaPoly_BLAKE2s`** (`frost-client/src/cipher.rs`) | Payloads, end to end. The server cannot read them. |

The `_K_` in the Noise pattern means **both parties' static public keys are known before the
handshake**. That gives mutual authentication and confidentiality between participants,
independent of the server — which is exactly what C5 requires for DKG.

**The caveat that matters.** `Noise_K` presupposes participants already hold each other's
public keys. That out-of-band exchange is the real man-in-the-middle surface: compromise the
moment contacts are exchanged and you are inside the vault from key generation onward, with
nothing downstream able to detect it. Our key-ceremony UI (F1) has to treat contact
verification as a security step the user performs deliberately, not a setup detail to breeze
past.

## 6. ⚠️ Developer-experience findings

**The default ciphersuite is `ed25519` on every binary.** `trusted-dealer --help` shows
`[default: ed25519]`. Forget `-C redpallas` once and you get signatures that verify perfectly
and authorize nothing on Zcash. Constraint C4 is not paranoia.

**The `coordinator` binary is CLI-transport only.** Its `cli()` hardcodes `CLIComms`, despite
`--help` advertising "socket communication is enabled" and despite `-i`/`-p` flags and working
`comms/socket.rs` and `comms/http.rs` modules. The `participant` binary selects all three
correctly; the coordinator does not. Attempting a socket round produces
`Error in scalar Field.` and participants that cannot connect.

The real multi-process path is **`frost-client` + `frostd`**, not the standalone demo binaries.
Budget for that when planning P1-A1.

**What does work, verified:**

```bash
trusted-dealer -C redpallas -t 2 -n 3     # → FROST(Pallas, BLAKE2b-512) ✅
cargo test -p frostd test_main_router_redpallas   # ✅ passes
cargo test -p frost-client --lib                  # ✅ 14 passed
```

## 7. 🔴 Open issue — FVK derivation vs Ironwood quantum recoverability

**This is the one finding that could move scope, and we cannot resolve it alone.**

`zcash-sign` builds the Orchard full viewing key for a FROST group like this
(`zcash-sign/src/generate.rs`): generate a throwaway `SpendingKey`, then combine it with the
FROST group verifying key as the spend validating key via

```
FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed(&sk, ak)
```

Two problems:

1. **That function is not in the published `orchard` crate.** It comes from the fork, via
   [zcash/orchard#475](https://github.com/zcash/orchard/pull/475), which is **still open**. The
   released `orchard 0.15.5` does expose `unstable-frost`, but that feature only makes
   `SpendValidatingKey::to_bytes` and `from_bytes` public — not this constructor.
2. **The name states it is incompatible with quantum recoverability**, and quantum
   recoverability (ZIP-2005) is the defining property of the Ironwood pool we are targeting
   under constraint C1.

We do not know whether this means a FROST vault cannot properly live in Ironwood, or whether it
only forfeits future post-quantum recovery while transacting normally. The second reading is
more likely — ZIP-2005 changes note commitment construction, not spend authorization — but
**we will not guess about this in a custody product.**

**Action, and it doubles as P0-B5 outreach:** ask the Zcash Foundation directly. Concretely —
*"For a FROST-controlled Orchard/Ironwood vault, what is the intended FVK derivation now that
`from_sk_ak_...` is marked for removal, and does using it forfeit Ironwood's quantum
recoverability for those funds?"*

This is a genuinely good first contact: specific, informed, and about work they own.

**Contingency if the answer is bad:** the R1 fallback in
[06-risk-register.md](06-risk-register.md) already covers it — demo a threshold-signed
**Sapling** spend and state precisely why Ironwood is blocked, citing the PR. That remains a
credible result in front of a Zcash judge. It is not the outcome we want, but it is planned for.

## 8. ✅ PCZT supports Ironwood

`pczt 0.8.0-rc.1` carries `ironwood: orchard::Bundle` — Ironwood **reuses the Orchard bundle
type**, consistent with v6 being "v5 plus an Ironwood bundle". The Signer role handles
`orchard::ValuePool::Ironwood` explicitly and tags signatures with their value pool.

There is no separate `ironwood` cargo feature; the `orchard` feature covers both pools.

Still unverified, and now the top Phase 1 risk: whether **anchor deferral** is implemented
(librustzcash [#2525](https://github.com/zcash/librustzcash/issues/2525) is still open) and
whether `zcash_client_backend 0.24.0-rc.1`'s proto matches the endpoint's `CompactTx` field 9
`ironwoodActions`. Both are P1-A4 / P1-B1 work.

---

## Recommended scope changes

1. **Keep Ironwood as the target, but treat §7 as a gate on Phase 1.** Send the ZF question
   today. If there is no answer by 24 Sep, proceed on the reading that spend authorization is
   unaffected, and say so explicitly in the submission.
2. **Drop "follow the demo's patterns" from P1-A1.** The demo is v2. Use §4 of this report and
   the smoke tests as the reference.
3. **Plan P1-A1 around `frost-client` + `frostd`**, not the standalone `coordinator` binary.
4. **Audit the rest of the workspace dependency table before Phase 1.** Two of eight pins were
   wrong; the rest are unexercised and unverified.
5. **Treat contact/public-key exchange as a security step in F1**, not setup chrome — see §5.
