//! Spike S1 verification — does our pinned v3 stack actually produce a valid
//! rerandomized RedPallas signature?
//!
//! This is not application code. It is the evidence behind Gate A: the
//! reference demo (`frost-zcash-demo`) is still on FROST v2, so nothing
//! upstream demonstrates the v3 path we pinned. These tests do.
//!
//! See docs/12-spike-s1-report.md.

use std::collections::BTreeMap;

use frost_core::{
    keys::{self, IdentifierList, KeyPackage},
    round1, Identifier, SigningPackage,
};
use frost_rerandomized::{aggregate, sign_with_randomizer_seed, RandomizedParams};
use quorum_core::Ciphersuite as Suite;

const MIN_SIGNERS: u16 = 2;
const MAX_SIGNERS: u16 = 3;
const MESSAGE: &[u8] = b"Quorum spike S1 - 2-of-3 rerandomized RedPallas";

/// Deals a 2-of-3 key set and runs round 1 for the first `MIN_SIGNERS`.
/// Trusted dealer rather than DKG on purpose: this isolates the *signing*
/// path. DKG is exercised separately in P1-A1.
#[allow(clippy::type_complexity)]
fn setup() -> (
    BTreeMap<Identifier<Suite>, KeyPackage<Suite>>,
    keys::PublicKeyPackage<Suite>,
    Vec<Identifier<Suite>>,
    BTreeMap<Identifier<Suite>, round1::SigningNonces<Suite>>,
    BTreeMap<Identifier<Suite>, round1::SigningCommitments<Suite>>,
) {
    let mut rng = rand::thread_rng();

    let (shares, pubkeys) = keys::generate_with_dealer::<Suite, _>(
        MAX_SIGNERS,
        MIN_SIGNERS,
        IdentifierList::Default,
        &mut rng,
    )
    .expect("dealer keygen");

    let key_packages: BTreeMap<_, _> = shares
        .into_iter()
        .map(|(id, share)| (id, KeyPackage::try_from(share).expect("key package")))
        .collect();

    let signers: Vec<_> = key_packages.keys().take(MIN_SIGNERS as usize).copied().collect();

    let mut nonces = BTreeMap::new();
    let mut commitments = BTreeMap::new();
    for id in &signers {
        let (n, c) = round1::commit(key_packages[id].signing_share(), &mut rng);
        nonces.insert(*id, n);
        commitments.insert(*id, c);
    }

    (key_packages, pubkeys, signers, nonces, commitments)
}

#[test]
fn two_of_three_rerandomized_signature_verifies() {
    let mut rng = rand::thread_rng();
    let (key_packages, pubkeys, signers, nonces, commitments) = setup();

    // The coordinator derives the randomizer from the commitments of every
    // participating signer. This is the v3 change that matters: the randomizer
    // is bound to this specific set of commitments, so participants do not have
    // to trust the coordinator's RNG. Regenerating it from the seed is what
    // `sign_with_randomizer_seed` does on each participant.
    let (params, randomizer_seed) = RandomizedParams::<Suite>::new_from_commitments(
        pubkeys.verifying_key(),
        &commitments,
        &mut rng,
    )
    .expect("randomized params");

    let signing_package = SigningPackage::new(commitments, MESSAGE);

    let mut signature_shares = BTreeMap::new();
    for id in &signers {
        let share = sign_with_randomizer_seed(
            &signing_package,
            &nonces[id],
            &key_packages[id],
            &randomizer_seed,
        )
        .expect("round 2");
        signature_shares.insert(*id, share);
    }

    let signature = aggregate(&signing_package, &signature_shares, &pubkeys, &params)
        .expect("aggregate");

    // Crucially, the signature verifies against the RANDOMIZED verifying key,
    // not the group key. That randomized key is what a Zcash spend
    // authorization is checked against.
    params
        .randomized_verifying_key()
        .verify(MESSAGE, &signature)
        .expect("signature must verify against the randomized verifying key");
}

#[test]
fn corrupted_share_is_attributed_to_its_signer() {
    // This is the mechanism behind product feature F4. If this ever stops
    // naming the right participant, the misbehaving-signer UI is lying.
    let mut rng = rand::thread_rng();
    let (key_packages, pubkeys, signers, nonces, commitments) = setup();

    let (params, randomizer_seed) = RandomizedParams::<Suite>::new_from_commitments(
        pubkeys.verifying_key(),
        &commitments,
        &mut rng,
    )
    .expect("randomized params");

    let signing_package = SigningPackage::new(commitments, MESSAGE);

    let mut signature_shares = BTreeMap::new();
    for id in &signers {
        let share = sign_with_randomizer_seed(
            &signing_package,
            &nonces[id],
            &key_packages[id],
            &randomizer_seed,
        )
        .expect("round 2");
        signature_shares.insert(*id, share);
    }

    // Swap one signer's share for another's — a share that is well-formed but
    // does not correspond to this signer's commitment.
    let (victim, other) = (signers[0], signers[1]);
    let other_share = signature_shares[&other];
    signature_shares.insert(victim, other_share);

    let err = aggregate(&signing_package, &signature_shares, &pubkeys, &params)
        .expect_err("aggregation must reject a mismatched share");

    let culprits = err.culprits();
    assert!(
        culprits.contains(&victim),
        "expected {victim:?} to be named as a culprit, got {culprits:?}",
    );
}
