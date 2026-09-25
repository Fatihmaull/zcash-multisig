//! A PCZT belongs to exactly one vault, and the coordinator checks which.
//!
//! # Why this test exists
//!
//! On 24 September the three-process signing demo reported *APPROVED, 2
//! signatures* for a PCZT built by a different vault than the one whose
//! shares signed it. Every part of that was real except the part that
//! mattered: three processes, valid commitments, valid shares, successful
//! aggregation — authorizing a transaction the vault has no claim on.
//!
//! Nothing was wrong with FROST. The signers are handed the alphas the
//! transaction specifies, so they sign under `ak_ours.randomize(alpha_theirs)`
//! and every share verifies against the commitments. Aggregation succeeds.
//! The signature is valid. It authorizes nothing, and the only place that
//! becomes visible is a node rejecting the broadcast.
//!
//! # What runs where
//!
//! The end-to-end check needs a real PCZT, and PCZTs live under `secrets/`,
//! which is gitignored — a PCZT carries the spending vault's full viewing key,
//! and committing one would publish a vault's entire history. So the
//! end-to-end test is `#[ignore]`d, and what runs in CI is the arithmetic the
//! check rests on: that two vaults cannot share a randomized key.

use ff::Field;
use frost_core::keys::PublicKeyPackage;
use orchard::keys::SpendValidatingKey;
use pasta_curves::pallas;
use quorum_core::Ciphersuite;

/// Two vaults, one alpha, two different randomized keys.
///
/// This is the whole content of the binding check. If it ever fails, `rk`
/// stops identifying a vault and the check in `pczt_job::collect` becomes
/// decoration.
#[test]
fn the_same_randomizer_under_two_vaults_gives_different_keys() {
    let mut rng = rand::thread_rng();

    let ak_for = |seed: u64| -> SpendValidatingKey {
        let (_shares, pubkeys) = frost_core::keys::generate_with_dealer::<Ciphersuite, _>(
            3,
            2,
            frost_core::keys::IdentifierList::Default,
            &mut rand_chacha_from(seed),
        )
        .expect("trusted dealer");
        SpendValidatingKey::from_bytes(&pubkeys.verifying_key().serialize().expect("serialise"))
            .expect("a FROST group key is a valid Orchard ak")
    };

    let ours = ak_for(1);
    let theirs = ak_for(2);
    assert_ne!(
        ours.to_bytes(),
        theirs.to_bytes(),
        "two independent ceremonies produced the same group key"
    );

    // The randomizer the transaction fixes. Both vaults are handed the same
    // one, which is exactly the situation that fooled the demo.
    let alpha = pallas::Scalar::random(&mut rng);

    assert_ne!(
        <[u8; 32]>::from(&ours.randomize(&alpha)),
        <[u8; 32]>::from(&theirs.randomize(&alpha)),
        "the same alpha randomized two different vaults to the same key — \
         rk no longer identifies a vault and the binding check is vacuous"
    );

    // And the check must not be vacuous in the other direction either: the
    // right vault under the right alpha has to match itself, or every
    // legitimate transaction is refused.
    assert_eq!(
        <[u8; 32]>::from(&ours.randomize(&alpha)),
        <[u8; 32]>::from(&ours.randomize(&alpha)),
    );
}

/// The end-to-end refusal, against real PCZTs.
///
/// ```sh
/// cargo test -p quorum-coordinator --test pczt_vault_binding -- --ignored --nocapture
/// ```
///
/// Needs `secrets/vault` (which owns `secrets/pczt/unsigned.pczt`) and
/// `secrets/vault-3p` (which does not). Reproduce them with
/// `cargo run -p quorum-signer --example ceremony` and the `zcash-devtool`
/// recipe in `secrets/README-devtool-wallet.md`.
#[test]
#[ignore = "needs the local PCZT and vault fixtures under secrets/"]
fn the_wrong_vault_is_refused_and_the_right_one_is_not() {
    let pczt = std::fs::read("../../../secrets/pczt/unsigned.pczt")
        .or_else(|_| std::fs::read("secrets/pczt/unsigned.pczt"))
        .expect("an unsigned PCZT fixture");

    let ak_of = |dir: &str| -> SpendValidatingKey {
        let raw = std::fs::read(format!("{dir}/public-key-package.json"))
            .or_else(|_| std::fs::read(format!("../../../{dir}/public-key-package.json")))
            .expect("a vault fixture");
        let pk: PublicKeyPackage<Ciphersuite> = serde_json::from_slice(&raw).expect("parse");
        SpendValidatingKey::from_bytes(&pk.verifying_key().serialize().expect("serialise"))
            .expect("ak")
    };

    let job = quorum_coordinator::inspect(&pczt, &ak_of("secrets/vault"))
        .expect("the owning vault must be accepted");
    assert!(!job.actions.is_empty(), "nothing to sign — wrong bundle?");

    match quorum_coordinator::inspect(&pczt, &ak_of("secrets/vault-3p")) {
        Err(quorum_coordinator::PcztError::WrongVault { index }) => assert_eq!(index, 0),
        Err(other) => panic!("refused for the wrong reason: {other}"),
        Ok(_) => panic!(
            "a PCZT from another vault was accepted — this is the 24 September bug, back again"
        ),
    }
}

/// A deterministic RNG, so the two group keys in the test above are fixed
/// rather than merely probably different.
fn rand_chacha_from(seed: u64) -> impl rand::RngCore + rand::CryptoRng {
    use rand::SeedableRng;
    let mut bytes = [0u8; 32];
    bytes[..8].copy_from_slice(&seed.to_le_bytes());
    rand::rngs::StdRng::from_seed(bytes)
}
