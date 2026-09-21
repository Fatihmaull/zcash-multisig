//! The key share on disk.
//!
//! The realistic threat is not a cryptanalyst — it is a stolen laptop, a
//! careless backup, or a folder that turned out to be syncing to someone's
//! cloud drive.

use frost_core::keys::{self, IdentifierList, KeyPackage};
use quorum_core::Ciphersuite;
use quorum_signer::store::{open, seal, StoreError};

fn a_key_package() -> KeyPackage<Ciphersuite> {
    let mut rng = rand::thread_rng();
    let (shares, _) =
        keys::generate_with_dealer::<Ciphersuite, _>(3, 2, IdentifierList::Default, &mut rng)
            .expect("dealer keygen");
    let (_, share) = shares.into_iter().next().expect("a share");
    KeyPackage::try_from(share).expect("key package")
}

#[test]
fn a_share_survives_the_round_trip() {
    let mut rng = rand::thread_rng();
    let original = a_key_package();

    let sealed = seal(&original, "correct horse battery staple", &mut rng).expect("seal");
    let opened = open(&sealed, "correct horse battery staple").expect("open");

    assert_eq!(
        original.signing_share().serialize(),
        opened.signing_share().serialize(),
        "the share must come back byte for byte"
    );
    assert_eq!(original.identifier(), opened.identifier());
}

#[test]
fn the_share_is_not_sitting_in_the_file() {
    // The obvious failure — writing the plaintext next to a nonce and calling
    // it encrypted — would pass a round-trip test perfectly.
    let mut rng = rand::thread_rng();
    let package = a_key_package();
    let secret = package.signing_share().serialize();

    let sealed = seal(&package, "passphrase", &mut rng).expect("seal");

    assert!(
        !sealed.windows(secret.len()).any(|w| w == secret.as_slice()),
        "the plaintext share must not appear anywhere in the file"
    );
}

#[test]
fn a_wrong_passphrase_is_refused() {
    let mut rng = rand::thread_rng();
    let sealed = seal(&a_key_package(), "the right one", &mut rng).expect("seal");
    assert!(matches!(
        open(&sealed, "the wrong one"),
        Err(StoreError::CannotDecrypt)
    ));
}

#[test]
fn a_tampered_file_is_refused_and_looks_the_same_as_a_bad_passphrase() {
    // Deliberately indistinguishable. Telling the two apart would tell an
    // attacker which of the two they had already got right.
    let mut rng = rand::thread_rng();
    let mut sealed = seal(&a_key_package(), "passphrase", &mut rng).expect("seal");
    let last = sealed.len() - 1;
    sealed[last] ^= 0x01;

    assert!(matches!(
        open(&sealed, "passphrase"),
        Err(StoreError::CannotDecrypt)
    ));
}

#[test]
fn two_seals_of_one_share_differ() {
    // Salt and nonce are fresh each time. Identical files would leak that
    // two participants hold the same share, or that a share was re-saved
    // unchanged.
    let mut rng = rand::thread_rng();
    let package = a_key_package();
    let a = seal(&package, "passphrase", &mut rng).expect("seal");
    let b = seal(&package, "passphrase", &mut rng).expect("seal");
    assert_ne!(a, b);

    // Both still open.
    assert_eq!(
        open(&a, "passphrase")
            .expect("a")
            .signing_share()
            .serialize(),
        open(&b, "passphrase")
            .expect("b")
            .signing_share()
            .serialize()
    );
}

#[test]
fn junk_is_rejected_with_something_readable() {
    assert!(matches!(open(&[], "p"), Err(StoreError::NotAShareFile)));
    assert!(matches!(
        open(&[99, 1, 2, 3], "p"),
        Err(StoreError::UnknownFormat { found: 99 })
    ));
    assert!(matches!(open(&[1, 2, 3], "p"), Err(StoreError::Truncated)));
}
