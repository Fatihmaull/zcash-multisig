//! **The proof the whole project rests on.**
//!
//! Does a 2-of-3 FROST threshold signature actually authorize an Orchard
//! spend? Everything else — the ceremony, the coordination, the UI — is
//! decoration if the answer is no.
//!
//! This verifies the signature the way Zcash does: against the *randomized*
//! spend validating key `rk = ak + [alpha]G`, using Orchard's own verifier,
//! not FROST's. Needs no funds, no node and no network, so it can gate Phase 1
//! before a single testnet coin exists.
//!
//! # Why this is not `redpallas_v3_smoke.rs`
//!
//! That test uses `RandomizedParams::new_from_commitments()`, the path FROST
//! v3 recommends — where the signer chooses the randomizer. **Zcash does not
//! work that way.** Each Orchard action carries its own `alpha`, fixed when
//! the transaction was built, read out of the PCZT. The signer must use that
//! value or the signature authorizes nothing.
//!
//! So this uses `frost_rerandomized::sign()` with an explicit `Randomizer`,
//! under `#[allow(deprecated)]`.
//!
//! **That deprecation cannot be honoured here.** Its replacement,
//! `sign_with_randomizer_seed()`, *derives* the randomizer from a seed plus
//! the round-1 commitments — there is no way to make it produce a specific
//! value. The one public API that accepts a given randomizer is the
//! deprecated one, because `KeyPackage::randomize` is private to
//! `frost-rerandomized` (the `Randomize` trait is not exported).
//!
//! So: for Zcash, deprecated `sign()` is the only route. Do not "modernise"
//! this — doing so silently produces signatures that authorize nothing.
//! Worth raising upstream as an API gap.
//!
//! See `docs/13-phase-1-plan.md`.

use std::collections::BTreeMap;

use ff::Field;
use frost_core::{
    keys::{self, IdentifierList, KeyPackage},
    round1, Identifier, SigningPackage,
};
#[allow(deprecated)]
use frost_rerandomized::sign as sign_with_randomizer;
use frost_rerandomized::{aggregate, RandomizedParams, Randomizer};
use orchard::keys::SpendValidatingKey;
use orchard::primitives::redpallas::{self, SpendAuth};
use pasta_curves::pallas;
use quorum_core::Ciphersuite;

/// Stands in for a PCZT sighash. In the real flow this is the transaction's
/// sighash, and every action in the transaction signs over this same value.
const SIGHASH: &[u8] = b"quorum::pczt-sighash-stand-in--32b";

#[test]
fn frost_signature_is_a_valid_orchard_spend_authorization() {
    let mut rng = rand::thread_rng();

    // ── Key ceremony (trusted dealer stands in for DKG here) ──
    let (shares, pubkeys) =
        keys::generate_with_dealer::<Ciphersuite, _>(3, 2, IdentifierList::Default, &mut rng)
            .expect("dealer keygen");
    let key_packages: BTreeMap<Identifier<Ciphersuite>, KeyPackage<Ciphersuite>> = shares
        .into_iter()
        .map(|(id, s)| (id, KeyPackage::try_from(s).expect("key package")))
        .collect();

    // The vault's spend validating key IS the FROST group verifying key.
    let group_bytes = pubkeys.verifying_key().serialize().expect("serialize");
    let ak = SpendValidatingKey::from_bytes(&group_bytes)
        .expect("FROST group key must be a valid Orchard ak");

    // ── The randomizer comes from the transaction, not from us ──
    // In production: action.spend().alpha() out of the PCZT bundle.
    let alpha = pallas::Scalar::random(&mut rng);

    // ── Round 1 — two of three signers commit ──
    let signers: Vec<_> = key_packages.keys().take(2).copied().collect();
    let mut nonces = BTreeMap::new();
    let mut commitments = BTreeMap::new();
    for id in &signers {
        let (n, c) = round1::commit(key_packages[id].signing_share(), &mut rng);
        nonces.insert(*id, n);
        commitments.insert(*id, c);
    }

    // ── Coordinator binds FROST to the transaction's alpha ──
    let params = RandomizedParams::<Ciphersuite>::from_randomizer(
        pubkeys.verifying_key(),
        Randomizer::from_scalar(alpha),
    );
    let signing_package = SigningPackage::new(commitments, SIGHASH);

    // ── Round 2 ──
    let mut sig_shares = BTreeMap::new();
    for id in &signers {
        #[allow(deprecated)]
        let share = sign_with_randomizer(
            &signing_package,
            &nonces[id],
            &key_packages[id],
            Randomizer::from_scalar(alpha),
        )
        .expect("round 2 sign");
        sig_shares.insert(*id, share);
    }

    let signature = aggregate(&signing_package, &sig_shares, &pubkeys, &params).expect("aggregate");

    // ── The part that matters: Orchard's own verifier ──
    // rk is what a Zcash validator checks a spend auth signature against.
    let rk: redpallas::VerificationKey<SpendAuth> = ak.randomize(&alpha);

    let sig_bytes: [u8; 64] = signature
        .serialize()
        .expect("serialize signature")
        .try_into()
        .expect("a RedPallas signature is 64 bytes");

    rk.verify(SIGHASH, &redpallas::Signature::<SpendAuth>::from(sig_bytes))
        .expect(
            "a 2-of-3 FROST signature must verify as an Orchard spend authorization \
             against the randomized validating key",
        );
}

#[test]
fn a_signature_under_the_wrong_alpha_is_rejected() {
    // Guards the failure that would be invisible otherwise: signing with a
    // randomizer that is not the action's. FROST would be perfectly happy —
    // the signature is valid for *some* key. Zcash would reject it, and the
    // transaction would fail at the node with nothing local to explain why.
    let mut rng = rand::thread_rng();

    let (shares, pubkeys) =
        keys::generate_with_dealer::<Ciphersuite, _>(3, 2, IdentifierList::Default, &mut rng)
            .expect("dealer keygen");
    let key_packages: BTreeMap<_, KeyPackage<Ciphersuite>> = shares
        .into_iter()
        .map(|(id, s)| (id, KeyPackage::try_from(s).expect("key package")))
        .collect();

    let group_bytes = pubkeys.verifying_key().serialize().expect("serialize");
    let ak = SpendValidatingKey::from_bytes(&group_bytes).expect("valid ak");

    let action_alpha = pallas::Scalar::random(&mut rng);
    let wrong_alpha = pallas::Scalar::random(&mut rng);

    let signers: Vec<_> = key_packages.keys().take(2).copied().collect();
    let mut nonces = BTreeMap::new();
    let mut commitments = BTreeMap::new();
    for id in &signers {
        let (n, c) = round1::commit(key_packages[id].signing_share(), &mut rng);
        nonces.insert(*id, n);
        commitments.insert(*id, c);
    }

    // Signed under the WRONG randomizer.
    let params = RandomizedParams::<Ciphersuite>::from_randomizer(
        pubkeys.verifying_key(),
        Randomizer::from_scalar(wrong_alpha),
    );
    let signing_package = SigningPackage::new(commitments, SIGHASH);

    let mut sig_shares = BTreeMap::new();
    for id in &signers {
        #[allow(deprecated)]
        let share = sign_with_randomizer(
            &signing_package,
            &nonces[id],
            &key_packages[id],
            Randomizer::from_scalar(wrong_alpha),
        )
        .expect("sign");
        sig_shares.insert(*id, share);
    }
    let signature = aggregate(&signing_package, &sig_shares, &pubkeys, &params).expect("aggregate");

    // FROST is satisfied — it verifies against its own randomized key.
    params
        .randomized_verifying_key()
        .verify(SIGHASH, &signature)
        .expect("FROST considers this signature perfectly valid");

    // Zcash is not.
    let rk: redpallas::VerificationKey<SpendAuth> = ak.randomize(&action_alpha);
    let sig_bytes: [u8; 64] = signature.serialize().expect("ser").try_into().expect("64");
    assert!(
        rk.verify(SIGHASH, &redpallas::Signature::<SpendAuth>::from(sig_bytes))
            .is_err(),
        "a signature made under the wrong alpha must not authorize the action"
    );
}
