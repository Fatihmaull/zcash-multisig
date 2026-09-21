//! Driving one transaction's worth of FROST signing.
//!
//! # This process holds no key material
//!
//! Commitments, signature shares and the group public key pass through here.
//! None of them is secret. **If a code path would bring a signing share into
//! this process, that path is wrong** — not "needs review", wrong. It is the
//! single invariant that makes the non-custodial claim true rather than
//! aspirational. See `docs/03-architecture.md` §2.
//!
//! # A round per action, not per transaction
//!
//! Every shielded input carries its own randomizer and needs its own
//! complete FROST round, all over the same sighash. The unit of work here is
//! therefore an **action**. Treating a transaction as one round signs the
//! first input and silently drops the rest.
//!
//! # Two rounds, as a typestate
//!
//! [`CollectingCommitments`] → [`CollectingShares`] → signatures. Round 2
//! cannot begin before threshold commitments are in, because the type that
//! can start it does not exist until then.

use std::collections::BTreeMap;

use frost_core::{
    keys::PublicKeyPackage, round1::SigningCommitments, round2::SignatureShare, Identifier,
    SigningPackage,
};
use frost_rerandomized::{RandomizedParams, Randomizer};
use quorum_core::Ciphersuite;

/// Which shielded bundle an action lives in.
///
/// A v6 transaction carries both, and either may hold spends. They are
/// reached through different entry points and **asking the wrong one returns
/// no spends rather than an error**, so the pool travels with the index.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShieldedPool {
    Orchard,
    Ironwood,
}

/// One spend awaiting authorization.
#[derive(Debug, Clone)]
pub struct Action {
    pub pool: ShieldedPool,
    /// Index within that pool's bundle.
    pub index: usize,
    /// The action's randomizer, read from the PCZT. Not chosen by us.
    pub alpha: [u8; 32],
}

#[derive(Debug, thiserror::Error)]
pub enum CoordinatorError {
    #[error("FROST rejected the round: {0}")]
    Frost(#[from] frost_core::Error<Ciphersuite>),

    /// A share did not verify, and FROST named who sent it.
    ///
    /// This is the feature-F4 path. The vault is untouched: aggregation
    /// failed, so no signature exists and nothing was broadcast. Keep the
    /// identifiers — telling a treasurer *which* signer to investigate is
    /// the entire value of cheater detection.
    #[error("signature share rejected on action {action_index}; culprits: {culprits:?}")]
    InvalidShare {
        action_index: usize,
        culprits: Vec<Identifier<Ciphersuite>>,
    },

    #[error("need {threshold} signers, have {have}")]
    BelowThreshold { threshold: u16, have: usize },

    #[error("{who:?} sent {received} {what} for a transaction with {expected} actions")]
    CountMismatch {
        who: Identifier<Ciphersuite>,
        what: &'static str,
        expected: usize,
        received: usize,
    },

    #[error("{0:?} already contributed to this round")]
    DuplicateContribution(Identifier<Ciphersuite>),

    #[error("a transaction must have at least one action to sign")]
    NoActions,

    #[error("randomizer on action {0} is not a valid scalar")]
    BadRandomizer(usize),
}

/// Round 1: gathering commitments.
pub struct CollectingCommitments {
    sighash: Vec<u8>,
    actions: Vec<Action>,
    threshold: u16,
    commitments: BTreeMap<Identifier<Ciphersuite>, Vec<SigningCommitments<Ciphersuite>>>,
}

impl CollectingCommitments {
    /// `actions` must be non-empty — see the note on [`CoordinatorError::NoActions`].
    pub fn new(
        sighash: Vec<u8>,
        actions: Vec<Action>,
        threshold: u16,
    ) -> Result<Self, CoordinatorError> {
        if actions.is_empty() {
            return Err(CoordinatorError::NoActions);
        }
        Ok(Self {
            sighash,
            actions,
            threshold,
            commitments: BTreeMap::new(),
        })
    }

    pub fn actions(&self) -> &[Action] {
        &self.actions
    }

    /// Record one signer's commitments — one per action.
    pub fn add(
        &mut self,
        signer: Identifier<Ciphersuite>,
        commitments: Vec<SigningCommitments<Ciphersuite>>,
    ) -> Result<(), CoordinatorError> {
        if self.commitments.contains_key(&signer) {
            // Accepting a second set would mean two nonce pairs from one
            // signer for one round, and there is no honest reason for it.
            return Err(CoordinatorError::DuplicateContribution(signer));
        }
        if commitments.len() != self.actions.len() {
            return Err(CoordinatorError::CountMismatch {
                who: signer,
                what: "commitments",
                expected: self.actions.len(),
                received: commitments.len(),
            });
        }
        self.commitments.insert(signer, commitments);
        Ok(())
    }

    pub fn have(&self) -> usize {
        self.commitments.len()
    }

    pub fn is_ready(&self) -> bool {
        self.have() >= self.threshold as usize
    }

    /// Build the signing packages. Fails below threshold.
    pub fn build(self) -> Result<CollectingShares, CoordinatorError> {
        if !self.is_ready() {
            return Err(CoordinatorError::BelowThreshold {
                threshold: self.threshold,
                have: self.have(),
            });
        }

        // One package per action, each carrying every participating signer's
        // commitment for that action.
        let mut packages = Vec::with_capacity(self.actions.len());
        for action_index in 0..self.actions.len() {
            let per_action: BTreeMap<_, _> = self
                .commitments
                .iter()
                .map(|(id, cs)| (*id, cs[action_index]))
                .collect();
            packages.push(SigningPackage::new(per_action, &self.sighash));
        }

        Ok(CollectingShares {
            actions: self.actions,
            signers: self.commitments.keys().copied().collect(),
            packages,
            shares: BTreeMap::new(),
        })
    }
}

/// Round 2: gathering signature shares.
pub struct CollectingShares {
    actions: Vec<Action>,
    signers: Vec<Identifier<Ciphersuite>>,
    packages: Vec<SigningPackage<Ciphersuite>>,
    shares: BTreeMap<Identifier<Ciphersuite>, Vec<SignatureShare<Ciphersuite>>>,
}

impl CollectingShares {
    /// Send these to the signers, alongside the randomizers.
    pub fn signing_packages(&self) -> &[SigningPackage<Ciphersuite>] {
        &self.packages
    }

    /// Per-action alphas, in the same order as the packages.
    pub fn randomizers(&self) -> Vec<[u8; 32]> {
        self.actions.iter().map(|a| a.alpha).collect()
    }

    pub fn actions(&self) -> &[Action] {
        &self.actions
    }

    pub fn expected_signers(&self) -> &[Identifier<Ciphersuite>] {
        &self.signers
    }

    pub fn add(
        &mut self,
        signer: Identifier<Ciphersuite>,
        shares: Vec<SignatureShare<Ciphersuite>>,
    ) -> Result<(), CoordinatorError> {
        if self.shares.contains_key(&signer) {
            return Err(CoordinatorError::DuplicateContribution(signer));
        }
        if shares.len() != self.actions.len() {
            return Err(CoordinatorError::CountMismatch {
                who: signer,
                what: "signature shares",
                expected: self.actions.len(),
                received: shares.len(),
            });
        }
        self.shares.insert(signer, shares);
        Ok(())
    }

    pub fn have(&self) -> usize {
        self.shares.len()
    }

    /// Aggregate into one signature per action.
    ///
    /// A bad share fails the whole transaction, by design: a partially
    /// authorized transaction is not a lesser success, it is a rejection at
    /// the node with nothing local to explain it. The error names the action
    /// and the culprits.
    pub fn aggregate(
        self,
        pubkeys: &PublicKeyPackage<Ciphersuite>,
    ) -> Result<Vec<[u8; 64]>, CoordinatorError> {
        if self.have() < self.signers.len() {
            return Err(CoordinatorError::BelowThreshold {
                threshold: self.signers.len() as u16,
                have: self.have(),
            });
        }

        let mut signatures = Vec::with_capacity(self.actions.len());
        for (action_index, (action, package)) in
            self.actions.iter().zip(self.packages.iter()).enumerate()
        {
            let randomizer = Randomizer::<Ciphersuite>::deserialize(&action.alpha)
                .map_err(|_| CoordinatorError::BadRandomizer(action_index))?;
            let params = RandomizedParams::from_randomizer(pubkeys.verifying_key(), randomizer);

            let per_action: BTreeMap<_, _> = self
                .shares
                .iter()
                .map(|(id, ss)| (*id, ss[action_index]))
                .collect();

            match frost_rerandomized::aggregate(package, &per_action, pubkeys, &params) {
                Ok(sig) => {
                    let bytes: [u8; 64] = sig
                        .serialize()
                        .map_err(CoordinatorError::Frost)?
                        .try_into()
                        .expect("a RedPallas signature is 64 bytes");
                    signatures.push(bytes);
                }
                Err(e) => {
                    // Preserve attribution. Flattening this to a message is
                    // how a treasurer ends up unable to tell which device to
                    // investigate.
                    let culprits = e.culprits();
                    if culprits.is_empty() {
                        return Err(CoordinatorError::Frost(e));
                    }
                    return Err(CoordinatorError::InvalidShare {
                        action_index,
                        culprits,
                    });
                }
            }
        }

        Ok(signatures)
    }
}
