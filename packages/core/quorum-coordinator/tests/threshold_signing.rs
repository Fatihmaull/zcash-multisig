//! Signer and coordinator, end to end.
//!
//! Two of three participants authorize a two-input transaction, and the
//! resulting signatures are checked with **Orchard's own verifier** against
//! `rk = ak.randomize(alpha)` — the same check a Zcash validator performs.
//!
//! No node, no funds, no network. This is the Gate B cryptography, provable
//! before a single testnet coin exists.

use std::collections::BTreeMap;

use ff::Field;
use frost_core::keys::{self, IdentifierList, KeyPackage};
use orchard::keys::SpendValidatingKey;
use orchard::primitives::redpallas::{self, SpendAuth};
use pasta_curves::group::ff::PrimeField;
use pasta_curves::pallas;
use quorum_coordinator::{Action, CollectingCommitments, CoordinatorError, ShieldedPool};
use quorum_core::Ciphersuite;
use quorum_signer::SigningSession;

/// Stands in for the PCZT sighash. Every action signs over this one value.
const SIGHASH: &[u8] = b"quorum::transaction-sighash-stand-in";

struct Vault {
    key_packages: BTreeMap<frost_core::Identifier<Ciphersuite>, KeyPackage<Ciphersuite>>,
    pubkeys: keys::PublicKeyPackage<Ciphersuite>,
    ak: SpendValidatingKey,
}

fn vault() -> Vault {
    let mut rng = rand::thread_rng();
    let (shares, pubkeys) =
        keys::generate_with_dealer::<Ciphersuite, _>(3, 2, IdentifierList::Default, &mut rng)
            .expect("dealer keygen");
    let key_packages = shares
        .into_iter()
        .map(|(id, s)| (id, KeyPackage::try_from(s).expect("key package")))
        .collect();
    let group = pubkeys.verifying_key().serialize().expect("serialize");
    let ak = SpendValidatingKey::from_bytes(&group).expect("group key is a valid ak");
    Vault {
        key_packages,
        pubkeys,
        ak,
    }
}

/// Two spends, each with its own randomizer — as a real PCZT would supply.
fn two_actions() -> Vec<Action> {
    let mut rng = rand::thread_rng();
    (0..2)
        .map(|index| Action {
            pool: ShieldedPool::Ironwood,
            index,
            alpha: pallas::Scalar::random(&mut rng).to_repr(),
        })
        .collect()
}

fn alpha_of(action: &Action) -> pallas::Scalar {
    pallas::Scalar::from_repr(action.alpha).expect("valid scalar")
}

#[test]
fn two_of_three_authorize_a_two_input_transaction() {
    let mut rng = rand::thread_rng();
    let v = vault();
    let actions = two_actions();

    let mut round =
        CollectingCommitments::new(SIGHASH.to_vec(), actions.clone(), 2).expect("round 1");

    // ── Round 1 — two signers commit, one commitment per action ──
    let signing: Vec<_> = v.key_packages.keys().take(2).copied().collect();
    let mut sessions = Vec::new();
    for id in &signing {
        let session =
            SigningSession::begin(&v.key_packages[id], actions.len(), &mut rng).expect("round 1");
        round
            .add(session.identifier(), session.commitments().to_vec())
            .expect("accept commitments");
        sessions.push(session);
    }
    assert!(round.is_ready(), "threshold reached");

    // ── Round 2 ──
    let mut round = round.build().expect("build packages");
    let packages = round.signing_packages().to_vec();
    let randomizers = round.randomizers();

    for session in sessions {
        let id = session.identifier();
        // `sign` consumes the session; the nonces cannot be reused.
        let shares = session
            .sign(&v.key_packages[&id], &packages, &randomizers)
            .expect("round 2");
        round.add(id, shares).expect("accept shares");
    }

    let signatures = round.aggregate(&v.pubkeys).expect("aggregate");
    assert_eq!(signatures.len(), 2, "one signature per action");

    // ── The check that matters: Orchard's verifier ──
    for (action, sig) in actions.iter().zip(signatures.iter()) {
        let rk: redpallas::VerificationKey<SpendAuth> = v.ak.randomize(&alpha_of(action));
        rk.verify(SIGHASH, &redpallas::Signature::<SpendAuth>::from(*sig))
            .unwrap_or_else(|e| {
                panic!("action {} must be authorized on Zcash: {e:?}", action.index)
            });
    }
}

#[test]
fn a_bad_share_names_its_signer_and_moves_nothing() {
    // Feature F4. What a treasurer needs is not "signing failed" but which
    // participant to investigate, and the assurance that nothing was spent.
    let mut rng = rand::thread_rng();
    let v = vault();
    let actions = two_actions();

    let mut round =
        CollectingCommitments::new(SIGHASH.to_vec(), actions.clone(), 2).expect("round 1");

    let signing: Vec<_> = v.key_packages.keys().take(2).copied().collect();
    let mut sessions = Vec::new();
    for id in &signing {
        let s = SigningSession::begin(&v.key_packages[id], actions.len(), &mut rng).expect("r1");
        round
            .add(s.identifier(), s.commitments().to_vec())
            .expect("add");
        sessions.push(s);
    }

    let mut round = round.build().expect("build");
    let packages = round.signing_packages().to_vec();
    let randomizers = round.randomizers();

    let mut all: Vec<_> = sessions
        .into_iter()
        .map(|s| {
            let id = s.identifier();
            let shares = s
                .sign(&v.key_packages[&id], &packages, &randomizers)
                .expect("sign");
            (id, shares)
        })
        .collect();

    // Swap the first signer's shares for the second's: well formed, but not
    // matching the commitment they made in round 1.
    let victim = all[0].0;
    all[0].1 = all[1].1.clone();

    for (id, shares) in all {
        round.add(id, shares).expect("add");
    }

    match round.aggregate(&v.pubkeys) {
        Err(CoordinatorError::InvalidShare {
            action_index,
            culprits,
        }) => {
            assert_eq!(action_index, 0, "the first action is where it fails");
            assert!(
                culprits.contains(&victim),
                "expected {victim:?} named; got {culprits:?}"
            );
        }
        Err(e) => panic!("expected attribution, got {e}"),
        Ok(_) => panic!("a mismatched share must not produce a signature"),
    }
}

#[test]
fn below_threshold_cannot_build_a_round() {
    let mut rng = rand::thread_rng();
    let v = vault();
    let actions = two_actions();
    let mut round =
        CollectingCommitments::new(SIGHASH.to_vec(), actions.clone(), 2).expect("round 1");

    let only = *v.key_packages.keys().next().expect("one");
    let s = SigningSession::begin(&v.key_packages[&only], actions.len(), &mut rng).expect("r1");
    round
        .add(s.identifier(), s.commitments().to_vec())
        .expect("add");

    assert!(!round.is_ready());
    assert!(matches!(
        round.build(),
        Err(CoordinatorError::BelowThreshold {
            threshold: 2,
            have: 1
        })
    ));
}

#[test]
fn a_signer_contributing_twice_is_refused() {
    // Two nonce sets from one signer in one round has no honest explanation.
    let mut rng = rand::thread_rng();
    let v = vault();
    let actions = two_actions();
    let mut round =
        CollectingCommitments::new(SIGHASH.to_vec(), actions.clone(), 2).expect("round 1");

    let id = *v.key_packages.keys().next().expect("one");
    let a = SigningSession::begin(&v.key_packages[&id], actions.len(), &mut rng).expect("r1");
    let b = SigningSession::begin(&v.key_packages[&id], actions.len(), &mut rng).expect("r1");

    round
        .add(id, a.commitments().to_vec())
        .expect("first is fine");
    assert!(matches!(
        round.add(id, b.commitments().to_vec()),
        Err(CoordinatorError::DuplicateContribution(_))
    ));
}

#[test]
fn a_transaction_with_no_actions_is_refused() {
    // An empty action list is what querying the wrong bundle of a v6
    // transaction looks like: success, with nothing in it.
    assert!(matches!(
        CollectingCommitments::new(SIGHASH.to_vec(), vec![], 2),
        Err(CoordinatorError::NoActions)
    ));
}

#[test]
fn a_signer_sending_the_wrong_number_of_shares_is_refused() {
    let mut rng = rand::thread_rng();
    let v = vault();
    let actions = two_actions();
    let mut round =
        CollectingCommitments::new(SIGHASH.to_vec(), actions.clone(), 2).expect("round 1");

    let signing: Vec<_> = v.key_packages.keys().take(2).copied().collect();
    let mut sessions = Vec::new();
    for id in &signing {
        let s = SigningSession::begin(&v.key_packages[id], actions.len(), &mut rng).expect("r1");
        round
            .add(s.identifier(), s.commitments().to_vec())
            .expect("add");
        sessions.push(s);
    }
    let mut round = round.build().expect("build");
    let packages = round.signing_packages().to_vec();
    let randomizers = round.randomizers();

    let s = sessions.remove(0);
    let id = s.identifier();
    let mut shares = s
        .sign(&v.key_packages[&id], &packages, &randomizers)
        .expect("sign");
    shares.truncate(1); // one action's worth for a two-action transaction

    assert!(matches!(
        round.add(id, shares),
        Err(CoordinatorError::CountMismatch {
            what: "signature shares",
            expected: 2,
            received: 1,
            ..
        })
    ));
}
