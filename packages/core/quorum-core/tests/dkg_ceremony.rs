//! A full 2-of-3 key ceremony, in process.
//!
//! No transport: packages move through `BTreeMap`s, which is exactly what the
//! `dkg` module's transport-free design buys. `frostd` delivery is tested
//! separately; this proves the protocol.
//!
//! What matters here is the end state — three participants each holding one
//! share, a group key none of them can reconstruct alone, and a Zcash address
//! derived from it.

use std::collections::BTreeMap;

use quorum_core::dkg::{DkgError, Round1, Round2, VaultConfig, VaultIdentifier};
use quorum_core::vault_key::VaultKey;
use quorum_core::Ciphersuite;

fn ids(n: u16) -> Vec<VaultIdentifier> {
    (1..=n)
        .map(|i| VaultIdentifier::try_from(i).expect("identifier"))
        .collect()
}

/// Drives all three rounds for every participant, routing packages the way a
/// coordinator would.
fn run_ceremony(
    config: VaultConfig,
) -> Result<BTreeMap<VaultIdentifier, quorum_core::dkg::Finished>, DkgError> {
    let mut rng = rand::thread_rng();
    let participants = ids(config.total);

    // ── Round 1 — broadcast ──
    let mut round1s: Vec<Round1> = Vec::new();
    for id in &participants {
        round1s.push(Round1::begin(*id, config, &mut rng)?);
    }
    let broadcast: BTreeMap<_, _> = round1s
        .iter()
        .map(|r| (r.identifier(), r.broadcast_package().clone()))
        .collect();

    // ── Round 2 — each participant sees everyone else's round 1 ──
    let mut round2s: Vec<Round2> = Vec::new();
    for r1 in round1s {
        let me = r1.identifier();
        let others: BTreeMap<_, _> = broadcast
            .iter()
            .filter(|(id, _)| **id != me)
            .map(|(id, pkg)| (*id, pkg.clone()))
            .collect();
        round2s.push(r1.receive(others)?);
    }

    // ── Route round-2 packages to their addressees ──
    // Each is secret to one pair; in production these travel over the
    // confidential channel, never broadcast.
    let mut inbox: BTreeMap<VaultIdentifier, BTreeMap<VaultIdentifier, _>> = BTreeMap::new();
    for r2 in &round2s {
        for (recipient, pkg) in r2.packages_to_send() {
            inbox
                .entry(*recipient)
                .or_default()
                .insert(r2.identifier(), pkg.clone());
        }
    }

    // ── Round 3 ──
    let mut finished = BTreeMap::new();
    for r2 in round2s {
        let me = r2.identifier();
        let mine = inbox.remove(&me).unwrap_or_default();
        finished.insert(me, r2.receive(mine)?);
    }
    Ok(finished)
}

#[test]
fn two_of_three_ceremony_produces_one_group_key() {
    let config = VaultConfig::new(2, 3).expect("valid config");
    let finished = run_ceremony(config).expect("ceremony");

    assert_eq!(finished.len(), 3, "every participant must finish");

    // The whole point: three independent runs of the protocol converge on one
    // group key. If they disagreed, the shares would belong to different
    // vaults and no threshold of them could ever sign together.
    let keys: Vec<_> = finished
        .values()
        .map(|f| {
            f.public_key_package
                .verifying_key()
                .serialize()
                .expect("serialize")
        })
        .collect();
    assert!(
        keys.windows(2).all(|w| w[0] == w[1]),
        "all participants must agree on the group verifying key"
    );

    // Each holds a distinct share of that one key.
    let shares: Vec<_> = finished
        .values()
        .map(|f| f.key_package.signing_share().serialize())
        .collect();
    for i in 0..shares.len() {
        for j in (i + 1)..shares.len() {
            assert_ne!(shares[i], shares[j], "shares must differ per participant");
        }
    }
}

#[test]
fn the_ceremony_yields_a_zcash_vault_address() {
    let config = VaultConfig::new(2, 3).expect("valid config");
    let finished = run_ceremony(config).expect("ceremony");
    let mut rng = rand::thread_rng();

    let any = finished.values().next().expect("a participant");
    let vault = VaultKey::derive(&any.public_key_package, &mut rng).expect("derive vault key");

    // Every participant derives the same vault, because they agree on the
    // group key. The throwaway spending key differs per derivation and must
    // not affect `ak` — if it did, participants would disagree about which
    // address is theirs.
    let ak = orchard::keys::SpendValidatingKey::from(vault.full_viewing_key().clone()).to_bytes();
    let group = any
        .public_key_package
        .verifying_key()
        .serialize()
        .expect("serialize");
    assert_eq!(
        ak.as_slice(),
        group.as_slice(),
        "the vault's spend validating key must be the ceremony's group key"
    );

    let _addr = vault.address();
}

#[test]
fn a_missing_participant_aborts_rather_than_degrading() {
    // DKG has no threshold to fall back on. Signing tolerates absence — that
    // is what 2-of-3 means — but key generation does not: every participant
    // must contribute or there is no vault. Proceeding with fewer would
    // silently build a vault the missing person can never sign for.
    let config = VaultConfig::new(2, 3).expect("valid config");
    let mut rng = rand::thread_rng();

    let participants = ids(3);
    let r1 = Round1::begin(participants[0], config, &mut rng).expect("round 1");

    // Only one of the two expected packages arrives.
    let lonely = Round1::begin(participants[1], config, &mut rng).expect("round 1");
    let mut others = BTreeMap::new();
    others.insert(lonely.identifier(), lonely.broadcast_package().clone());

    match r1.receive(others) {
        Err(DkgError::IncompleteRound { expected, received }) => {
            assert_eq!((expected, received), (2, 1));
        }
        Err(e) => panic!("wrong error: {e}"),
        Ok(_) => panic!("a ceremony missing a participant must not proceed"),
    }
}

#[test]
fn one_of_n_is_rejected() {
    // A 1-of-n vault is a single point of failure wearing a threshold
    // costume — the exact problem Quorum exists to solve.
    assert!(matches!(
        VaultConfig::new(1, 3),
        Err(DkgError::InvalidConfig(_))
    ));
    assert!(matches!(
        VaultConfig::new(4, 3),
        Err(DkgError::InvalidConfig(_))
    ));
}

#[test]
fn ciphersuite_is_pinned_to_redpallas() {
    // Cheap guard against the failure that is invisible until funds do not
    // move: a signature under the wrong ciphersuite verifies fine and
    // authorizes nothing on Zcash.
    let name = <Ciphersuite as frost_core::Ciphersuite>::ID;
    assert!(
        name.contains("Pallas"),
        "expected a Pallas ciphersuite, got {name}"
    );
}
