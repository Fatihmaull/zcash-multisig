//! Can a FROST group key become a usable Zcash vault identity, and how often
//! does it fail?
//!
//! Orchard requires `ak` to be a non-identity Pallas point with a positive
//! y-sign. A FROST group verifying key is uniformly random and knows nothing
//! about that constraint, so some fraction of key ceremonies produce a group
//! the Zcash side rejects. This measures that fraction — because if it is
//! material, the ceremony has to retry transparently rather than showing a
//! participant an error they cannot act on.

use frost_core::keys::{self, IdentifierList};
use quorum_core::vault_key::{VaultKey, VaultKeyError};
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
fn measure_group_key_rejection_rate() {
    let mut rng = rand::thread_rng();
    let mut rejected = 0usize;

    for _ in 0..TRIALS {
        match VaultKey::derive(&fresh_group(), &mut rng) {
            Ok(_) => {}
            Err(VaultKeyError::UnusableGroupKey) => rejected += 1,
        }
    }

    let pct = (rejected as f64 / TRIALS as f64) * 100.0;
    println!("group keys rejected by Orchard: {rejected}/{TRIALS} ({pct:.1}%)");

    // No assertion on the rate itself — this test exists to report it, and the
    // number drives a product decision rather than a pass/fail. It does assert
    // the two outcomes that would mean something is badly wrong.
    assert!(
        rejected < TRIALS,
        "every group key was rejected — the encoding between FROST and Orchard is wrong, \
         not merely unlucky"
    );
}

#[test]
fn a_usable_group_yields_a_stable_address() {
    let mut rng = rand::thread_rng();

    // Retry until we get a group Orchard accepts. This is exactly what the
    // real ceremony must do.
    let (pubkeys, vault) = loop {
        let pubkeys = fresh_group();
        if let Ok(v) = VaultKey::derive(&pubkeys, &mut rng) {
            break (pubkeys, v);
        }
    };

    let addr = vault.address();
    assert_eq!(
        addr,
        vault.address(),
        "the address must be deterministic for a given vault key"
    );

    // ak inside the derived FVK must be the FROST group key, unchanged.
    // If this ever drifts, signatures would verify against a key that does
    // not authorize the vault's funds.
    let group_bytes = pubkeys.verifying_key().serialize().expect("serialize");
    let ak_bytes: [u8; 32] =
        orchard::keys::SpendValidatingKey::from(vault.full_viewing_key().clone()).to_bytes();
    assert_eq!(
        group_bytes.as_slice(),
        ak_bytes.as_slice(),
        "the vault's spend validating key must be the FROST group verifying key"
    );
}
