//! One participant's part in signing a transaction.
//!
//! # The nonce rule, and why the API is shaped like this
//!
//! FROST round 1 produces a nonce pair and a commitment. The commitment goes
//! to the coordinator; **the nonce stays here** and is needed again in round
//! 2. Between the two rounds a signer may wait hours.
//!
//! Using one nonce pair for two different signing packages **leaks the
//! signing share**. Not degrades — leaks. Two signatures over different
//! messages with the same nonce let anyone solve for the secret.
//!
//! So [`SigningSession::sign`] takes `self` by value. Once you have signed,
//! the session is gone and the nonces with it; a second attempt does not
//! compile. That is deliberate — this is the one mistake in the protocol
//! that cannot be recovered from, and a comment asking people to be careful
//! is not a control.
//!
//! # One session covers one transaction, N actions
//!
//! Every shielded input needs its own FROST round with its own randomizer,
//! all over the same sighash. A session therefore holds a nonce pair *per
//! action*, and signs them together.

use frost_core::{
    keys::KeyPackage,
    round1::{self, SigningCommitments, SigningNonces},
    round2::SignatureShare,
    Identifier, SigningPackage,
};
use frost_rerandomized::Randomizer;
use quorum_core::Ciphersuite;
use rand_core::{CryptoRng, RngCore};

#[derive(Debug, thiserror::Error)]
pub enum SignerError {
    #[error("FROST rejected the round: {0}")]
    Frost(#[from] frost_core::Error<Ciphersuite>),

    /// The coordinator sent a different number of packages, randomizers or
    /// both than this session has nonces for.
    ///
    /// Never proceed part-way. Signing a subset would produce a transaction
    /// authorizing some inputs and not others, which the node rejects with
    /// nothing local to explain it.
    #[error("expected {expected} {what}, coordinator sent {received}")]
    CountMismatch {
        what: &'static str,
        expected: usize,
        received: usize,
    },

    /// A randomizer did not parse as a Pallas scalar.
    #[error("randomizer {index} is not a valid scalar")]
    BadRandomizer { index: usize },

    #[error("a signing session needs at least one action")]
    NoActions,
}

/// Round 1 done; nonces held, awaiting the signing packages.
pub struct SigningSession {
    identifier: Identifier<Ciphersuite>,
    nonces: Vec<SigningNonces<Ciphersuite>>,
    commitments: Vec<SigningCommitments<Ciphersuite>>,
}

impl SigningSession {
    /// Run round 1 for `action_count` shielded inputs.
    ///
    /// Each action gets an independent nonce pair. Sharing one across
    /// actions would be the same leak as reusing one across rounds.
    pub fn begin<R: RngCore + CryptoRng>(
        key_package: &KeyPackage<Ciphersuite>,
        action_count: usize,
        rng: &mut R,
    ) -> Result<Self, SignerError> {
        if action_count == 0 {
            // An empty action list is what querying the wrong bundle of a v6
            // transaction looks like — it returns success with nothing in it.
            // Refuse rather than "succeed" at signing nothing.
            return Err(SignerError::NoActions);
        }

        let mut nonces = Vec::with_capacity(action_count);
        let mut commitments = Vec::with_capacity(action_count);
        for _ in 0..action_count {
            let (n, c) = round1::commit(key_package.signing_share(), rng);
            nonces.push(n);
            commitments.push(c);
        }

        Ok(Self {
            identifier: *key_package.identifier(),
            nonces,
            commitments,
        })
    }

    pub fn identifier(&self) -> Identifier<Ciphersuite> {
        self.identifier
    }

    /// The commitments to send. Public; the nonces behind them are not.
    pub fn commitments(&self) -> &[SigningCommitments<Ciphersuite>] {
        &self.commitments
    }

    /// Round 2. **Consumes the session**, so the nonces cannot be used twice.
    ///
    /// `randomizers` are the per-action alphas read from the PCZT, in the
    /// same order as the packages. They are *not* chosen here and not derived
    /// from the commitments: for Zcash the transaction fixes the randomizer,
    /// and signing under any other value produces a signature that verifies
    /// under FROST and authorizes nothing on chain.
    pub fn sign(
        self,
        key_package: &KeyPackage<Ciphersuite>,
        signing_packages: &[SigningPackage<Ciphersuite>],
        randomizers: &[[u8; 32]],
    ) -> Result<Vec<SignatureShare<Ciphersuite>>, SignerError> {
        if signing_packages.len() != self.nonces.len() {
            return Err(SignerError::CountMismatch {
                what: "signing packages",
                expected: self.nonces.len(),
                received: signing_packages.len(),
            });
        }
        if randomizers.len() != self.nonces.len() {
            return Err(SignerError::CountMismatch {
                what: "randomizers",
                expected: self.nonces.len(),
                received: randomizers.len(),
            });
        }

        let mut shares = Vec::with_capacity(self.nonces.len());
        for (index, ((package, nonces), alpha)) in signing_packages
            .iter()
            .zip(self.nonces.iter())
            .zip(randomizers.iter())
            .enumerate()
        {
            let randomizer = Randomizer::<Ciphersuite>::deserialize(alpha)
                .map_err(|_| SignerError::BadRandomizer { index })?;

            // Deprecated, and unavoidable. `sign_with_randomizer_seed`
            // *derives* the randomizer from a seed plus the commitments —
            // there is no way to make it produce a value the transaction
            // already fixed. The only public API accepting an explicit
            // randomizer is this one, because `KeyPackage::randomize` is
            // private to frost-rerandomized. See docs/12-spike-s1-report.md.
            #[allow(deprecated)]
            let share = frost_rerandomized::sign(package, nonces, key_package, randomizer)?;
            shares.push(share);
        }

        Ok(shares)
    }
}
