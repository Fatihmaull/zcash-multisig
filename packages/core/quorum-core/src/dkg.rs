//! Distributed key generation for a Quorum vault.
//!
//! Three rounds, modelled as a typestate so a round cannot be run out of
//! order: [`Round1`] → [`Round2`] → [`Finished`]. Each transition consumes
//! the previous state, so the round-1 secret cannot be reused after round 2
//! has begun.
//!
//! # No transport here, on purpose
//!
//! This module moves no bytes. It takes packages in and hands packages out,
//! leaving delivery to the caller — `frostd` in production, a `BTreeMap` in
//! tests. That is what lets the protocol be tested exhaustively in-process,
//! with no node and no network.
//!
//! # Channel requirements — the part that is easy to get wrong
//!
//! The two rounds do **not** have the same needs, and treating them alike is
//! how a vault gets silently compromised at birth.
//!
//! | Round | Shape | Channel |
//! |---|---|---|
//! | 1 | One package, **broadcast** to everyone | Authenticated |
//! | 2 | One package **per recipient**, each secret to that pair | Authenticated **and confidential** |
//!
//! Round-2 packages carry secret share material for one specific recipient.
//! Leak one and that participant's share is exposed; substitute one and the
//! attacker ends up holding a share of the vault. Neither failure announces
//! itself — the ceremony completes, the address looks fine, and the vault is
//! compromised from the moment it exists.
//!
//! `frostd` provides both properties: TLS to the server, plus Noise
//! `Noise_K_25519_ChaChaPoly_BLAKE2s` end to end between participants, so the
//! server itself cannot read round-2 traffic. The residual risk is the
//! bootstrap — `Noise_K` presupposes participants already hold each other's
//! static public keys, so **contact verification is a security step the user
//! performs deliberately**, not setup chrome.
//!
//! See `docs/03-architecture.md` §2 and constraint C5.

use std::collections::BTreeMap;

use frost_core::{
    keys::dkg::{self, round1, round2},
    keys::{KeyPackage, PublicKeyPackage},
    Error as FrostError, Identifier,
};
use rand_core::{CryptoRng, RngCore};

use crate::Ciphersuite;

/// Identifier type for this vault's ciphersuite.
pub type VaultIdentifier = Identifier<Ciphersuite>;

/// What can go wrong running a ceremony.
#[derive(Debug, thiserror::Error)]
pub enum DkgError {
    /// The underlying FROST protocol rejected something.
    ///
    /// `culprits()` on the inner error names participants where FROST can
    /// attribute the fault — a malformed round-2 package, for instance. Do
    /// not flatten this to a string: attribution is what lets a treasurer
    /// know whose device to investigate.
    #[error("FROST rejected the ceremony: {0}")]
    Frost(#[from] FrostError<Ciphersuite>),

    /// A round completed without hearing from everyone.
    ///
    /// Unlike signing, DKG has no threshold to fall back on — **every**
    /// participant must contribute or there is no vault. A missing package
    /// means restart, not proceed with fewer.
    #[error("expected packages from {expected} participants, received {received}")]
    IncompleteRound { expected: usize, received: usize },

    /// Threshold or participant count outside what the protocol allows.
    #[error("invalid configuration: {0}")]
    InvalidConfig(&'static str),
}

/// A vault's shape: `threshold`-of-`total`.
#[derive(Debug, Clone, Copy)]
pub struct VaultConfig {
    pub threshold: u16,
    pub total: u16,
}

impl VaultConfig {
    pub fn new(threshold: u16, total: u16) -> Result<Self, DkgError> {
        if threshold < 2 {
            // 1-of-n is a single point of failure wearing a threshold
            // costume, which is the exact problem Quorum exists to solve.
            return Err(DkgError::InvalidConfig(
                "threshold must be at least 2; 1-of-n is not shared control",
            ));
        }
        if total < threshold {
            return Err(DkgError::InvalidConfig(
                "total participants cannot be fewer than the threshold",
            ));
        }
        Ok(Self { threshold, total })
    }
}

/// Round 1 complete. Holds this participant's round-1 secret.
pub struct Round1 {
    identifier: VaultIdentifier,
    config: VaultConfig,
    secret: round1::SecretPackage<Ciphersuite>,
    /// Broadcast this to every other participant. Authenticated channel.
    package: round1::Package<Ciphersuite>,
}

/// Round 2 complete. Holds this participant's round-2 secret.
pub struct Round2 {
    identifier: VaultIdentifier,
    secret: round2::SecretPackage<Ciphersuite>,
    round1_packages: BTreeMap<VaultIdentifier, round1::Package<Ciphersuite>>,
    /// One package per recipient. **Confidential channel, per recipient.**
    packages: BTreeMap<VaultIdentifier, round2::Package<Ciphersuite>>,
}

/// The ceremony succeeded.
pub struct Finished {
    /// This participant's share. **Never leaves their machine.**
    pub key_package: KeyPackage<Ciphersuite>,
    /// Public, shared with everyone, including the coordinator.
    pub public_key_package: PublicKeyPackage<Ciphersuite>,
}

impl Round1 {
    /// Begin a ceremony as `identifier`.
    pub fn begin<R: RngCore + CryptoRng>(
        identifier: VaultIdentifier,
        config: VaultConfig,
        rng: R,
    ) -> Result<Self, DkgError> {
        let (secret, package) =
            dkg::part1::<Ciphersuite, R>(identifier, config.total, config.threshold, rng)?;
        Ok(Self {
            identifier,
            config,
            secret,
            package,
        })
    }

    /// The package to broadcast. Not secret; still must be authenticated, or
    /// an attacker substitutes their own and joins the vault.
    pub fn broadcast_package(&self) -> &round1::Package<Ciphersuite> {
        &self.package
    }

    pub fn identifier(&self) -> VaultIdentifier {
        self.identifier
    }

    /// Consume everyone else's round-1 packages and produce round 2.
    ///
    /// `others` must contain a package from every other participant — DKG
    /// tolerates no absence.
    pub fn receive(
        self,
        others: BTreeMap<VaultIdentifier, round1::Package<Ciphersuite>>,
    ) -> Result<Round2, DkgError> {
        let expected = self.config.total as usize - 1;
        if others.len() != expected {
            return Err(DkgError::IncompleteRound {
                expected,
                received: others.len(),
            });
        }

        let (secret, packages) = dkg::part2(self.secret, &others)?;
        Ok(Round2 {
            identifier: self.identifier,
            secret,
            round1_packages: others,
            packages,
        })
    }
}

impl Round2 {
    /// Per-recipient packages. **Each one is secret to that pair** — send
    /// over an authenticated *and confidential* channel, never broadcast.
    pub fn packages_to_send(&self) -> &BTreeMap<VaultIdentifier, round2::Package<Ciphersuite>> {
        &self.packages
    }

    pub fn identifier(&self) -> VaultIdentifier {
        self.identifier
    }

    /// Consume the round-2 packages addressed to us and finish.
    pub fn receive(
        self,
        addressed_to_us: BTreeMap<VaultIdentifier, round2::Package<Ciphersuite>>,
    ) -> Result<Finished, DkgError> {
        let expected = self.round1_packages.len();
        if addressed_to_us.len() != expected {
            return Err(DkgError::IncompleteRound {
                expected,
                received: addressed_to_us.len(),
            });
        }

        let (key_package, public_key_package) =
            dkg::part3(&self.secret, &self.round1_packages, &addressed_to_us)?;
        Ok(Finished {
            key_package,
            public_key_package,
        })
    }
}
