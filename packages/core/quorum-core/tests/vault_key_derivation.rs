//! Can a FROST group key become a usable Zcash vault identity, and is that
//! identity stable?
//!
//! The second question is the one that bit us. An earlier version drew the
//! seed inside `derive`, so every call produced a different address — and
//! 0.05 TAZ went to a vault nobody could ever open. These tests exist so
//! that cannot come back.

use frost_core::keys::{self, IdentifierList};
use quorum_core::vault_key::{VaultKey, VaultKeyError, VaultSeed};
use quorum_core::Ciphersuite;

const TRIALS: usize = 200;

fn fresh_group() -> keys::PublicKeyPackage<Ciphersuite> {
    let mut rng = rand::thread_rng();
    let (_shares, pubkeys) =
        keys::generate_with_dealer::<Ciphersuite, _>(3, 2, IdentifierList::Default, &mut rng)
            .expect("dealer keygen");
    pubkeys
}

#[test]
fn the_same_group_and_seed_always_give_the_same_vault() {
    // THE regression guard. If this fails, funds sent to a vault become
    // unreachable, and nothing downstream will tell you why.
    let mut rng = rand::thread_rng();
    let pubkeys = fresh_group();
    let seed = VaultSeed::generate(&mut rng);

    let first = VaultKey::derive(&pubkeys, &seed).expect("derive");
    for _ in 0..20 {
        let again = VaultKey::derive(&pubkeys, &seed).expect("derive");
        assert_eq!(
            first.address(),
            again.address(),
            "the vault address must not change between derivations"
        );
    }
}

#[test]
fn a_different_seed_gives_a_different_vault() {
    // The flip side: the seed must actually matter. If it did not, the
    // viewing key would be a function of the group key alone — and `ak` is
    // embedded in the address, so anyone holding the address could decrypt
    // every transaction the vault ever makes.
    let mut rng = rand::thread_rng();
    let pubkeys = fresh_group();

    let a = VaultKey::derive(&pubkeys, &VaultSeed::generate(&mut rng)).expect("derive");
    let b = VaultKey::derive(&pubkeys, &VaultSeed::generate(&mut rng)).expect("derive");
    assert_ne!(a.address(), b.address());
}

#[test]
fn measure_group_key_rejection_rate() {
    // Orchard requires ak to be a non-identity point with a positive y-sign,
    // and a FROST group key knows nothing about that. Measured rather than
    // assumed: if it were material, the ceremony would need to retry.
    let mut rng = rand::thread_rng();
    let seed = VaultSeed::generate(&mut rng);
    let mut rejected = 0usize;

    for _ in 0..TRIALS {
        match VaultKey::derive(&fresh_group(), &seed) {
            Ok(_) => {}
            Err(VaultKeyError::UnusableGroupKey) => rejected += 1,
            Err(e) => panic!("unexpected: {e}"),
        }
    }

    let pct = (rejected as f64 / TRIALS as f64) * 100.0;
    println!("group keys rejected by Orchard: {rejected}/{TRIALS} ({pct:.1}%)");
    assert!(
        rejected < TRIALS,
        "every group key was rejected — the encoding between FROST and Orchard is wrong, \
         not merely unlucky"
    );
}

#[test]
fn the_vaults_ak_is_the_groups_verifying_key() {
    // If the FVK derivation perturbed ak, signatures would verify against a
    // key that does not authorize the vault's funds.
    let mut rng = rand::thread_rng();
    let pubkeys = fresh_group();
    let vault = VaultKey::derive(&pubkeys, &VaultSeed::generate(&mut rng)).expect("derive");

    let group = pubkeys.verifying_key().serialize().expect("serialize");
    let ak = orchard::keys::SpendValidatingKey::from(vault.full_viewing_key().clone()).to_bytes();
    assert_eq!(group.as_slice(), ak.as_slice());
}
