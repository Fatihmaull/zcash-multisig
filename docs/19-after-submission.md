# 19 — First work after submission

**Written 1 October 2026, before the deadline, deliberately.** Each item below was
decided *not* to do before 10 October, and the reason is recorded next to it. Without
that, a deferral is indistinguishable from an oversight six weeks later.

Ordered by what a vault's owner would lose by waiting.

---

## 1 · Derive the viewing key the ZIP-2005 way

**This is the only item that changes what a vault is**, and it is first for that reason.

### Where we are

`quorum-core/src/vault_key.rs` builds the vault's Orchard full viewing key with:

```rust
FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed(&sk, ak)
```

It comes from the `conradoplg/orchard` fork, pending
[zcash/orchard#475](https://github.com/zcash/orchard/pull/475). `zcash-sign` depends on
the same thing.

Asked directly in
[ZcashFoundation/frost#1094](https://github.com/ZcashFoundation/frost/issues/1094), the
FROST maintainer answered on 21 September:

> *"if you use `from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed`
> you are giving up on quantum recoverability and would need to migrate to a new wallet
> then that is supported."*

So every vault this tool has created forfeits the property Ironwood exists to provide.
The remedy is migration to a vault derived correctly, not a fix applied to an existing
one.

### Where we should be

ZIP-2005 §4.2.3, *Usage with FROST*:

1. members agree `sk` privately
2. derive `nk`, `qsk`, `qk` and `rivk_ext` from it with `use_qsk = true`
3. `FullViewingKey::from_bytes(ak ‖ nk ‖ rivk_ext)` — 96 bytes, and the constructor is
   already public in the published crate

**Step 1 is already built.** Our `VaultSeed` is generated once at the ceremony and
distributed to every participant over the Noise channel, which is precisely "agree `sk`
privately". The Zafe team, on the same thread, describes the same arrangement. So the
architecture does not change; one derivation call does, plus the key material it feeds
on.

### Why it waited

`use_qsk`, `qsk` and `rivk_ext` do not exist in the `orchard` revision we build against.
Checked on 1 October: the crate implements ZIP-2005's quantum-recoverable **note**
derivation (`note.rs`) and nothing of the FROST key path.

So taking it today means hand-implementing key derivation against a specification still
in draft ([zcash/zips#895](https://github.com/zcash/zips/pull/895)), inside a custody
tool, three days before feature freeze, with no published test vectors to check against.
Writing our own crypto under deadline pressure is the trade we exist to argue against.

### Doing it

- [ ] Watch [zcash/zips#895](https://github.com/zcash/zips/pull/895) to completion, then
      its implementation in `orchard`
- [ ] Take the `use_qsk` test vectors when they publish. Another integrator offered
      theirs to `zcash-test-vectors` or `frost-tools` on the thread; **use someone
      else's vectors rather than minting our own**, since vectors written by the same
      person who wrote the derivation check nothing
- [ ] Switch `vault_key.rs`, keeping the old path behind a flag only long enough to
      migrate
- [ ] **Write the migration.** Existing vaults cannot be fixed in place: a new derivation
      is a new address. Moving funds needs a threshold signature from the old vault, so
      the migration is itself a ceremony plus a spend, and it must be documented before
      anyone is asked to run it
- [ ] Correct `docs/submission-draft.md` §9 once it is no longer true

---

## 2 · Challenge-response instead of bearer tokens

Signer routes authenticate with a per-participant bearer token, minted at vault
registration. It is a floor: it stops `participantId` being a bare claim, which was the
actual bug it fixed.

Participants already hold XEdDSA identities for `frostd`. Challenge-response against
those keys removes the shared secret entirely and reuses a key they must have anyway.

**Why it waited:** the token closed the hole that mattered, which was the event log
naming the wrong person. The upgrade is strictly better and strictly not urgent.

---

## 3 · Encrypt the coordinator-to-signer channel

Each action's `alpha` travels in the clear, as does the PCZT. Anyone who reads `alpha`
and knows the vault's `ak` can compute `rk` and link that transaction to the vault.

This is privacy, not custody: no amount of reading moves funds. But unlinkability is
most of what shielded means, and the maintainer's own phrasing on the thread was that
you *"need to trust the coordinator and all participants to keep alpha secret anyway"*.

**Why it waited:** we run everything on loopback, and the coordinator port is documented
as not facing a network. The moment two machines are involved, this is required rather
than nice.

---

## 4 · Reminders for a signer who has not answered

`TIMEOUT` is a first-class state and a request whose quorum becomes unreachable now
closes itself. Nothing chases a silent signer in between.

**Why it waited:** it needs a delivery channel, and choosing one is a product decision
rather than a protocol one.

---

## 5 · Follow the ciphersuite out of `reddsa`

`reddsa 0.6` dropped the FROST ciphersuites
([reddsa#963](https://github.com/ZcashFoundation/reddsa/issues/963)); they are moving
into the FROST repository. The maintainer confirmed on 1 October that the move keeps
`KeyPackage` serialization and everything else unchanged, and that 0.5.x will get
security fixes in the meantime if any are needed.

**Do not upgrade to `reddsa 0.6`.** The path is to the FROST repository's crate when it
lands. Until then `reddsa 0.5.2` with the `frost` feature is correct and pinned.

---

## 6 · The API fix we offered upstream

Our original question was that no public API accepts a transaction-supplied randomizer:
`RandomizedParams::from_randomizer()` is public, `KeyPackage::randomize` is not, and the
deprecation on `sign()` points at `sign_with_randomizer_seed()`, which derives the
randomizer and therefore cannot produce the `alpha` a transaction already fixed.

The maintainer replied that he will rethink the API and may simply un-deprecate `sign()`,
and that *"there will always be a mechanism for feeding an external randomizer since it
is required for Zcash"*.

We offered a PR and the offer stands. **Wait for the shape he wants** rather than
sending one, which is what the thread asked for.

---

## What is deliberately not on this list

Out of scope by decision rather than by deadline, and listed so the decision survives:

- **Signer rotation and share repair.** The libraries support both. We chose not to
  surface them, and that choice is not a backlog item
- **Mainnet.** Not until an external review exists, and a review is not a to-do we can
  write for ourselves
- **Hardware or air-gapped signers**
- **Any quorum policy beyond a fixed threshold** — tiered and dynamic policies were
  scoped out at the start
