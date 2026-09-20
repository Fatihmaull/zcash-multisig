//! Deriving a vault's Zcash identity from a FROST group key.
//!
//! A FROST group has a verifying key but no spending key — nobody holds one,
//! which is the entire point. Zcash still needs a full viewing key to produce
//! an address and to scan for notes. This module bridges the two.
//!
//! # The caveat you must not drop
//!
//! The only available constructor is
//! `FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed()`,
//! which exists solely in the `conradoplg/orchard` fork pending
//! [zcash/orchard#475]. Its name is not decoration: it builds `nk` and `rivk`
//! from a throwaway spending key rather than deriving all three together, and
//! that is what breaks quantum recoverability — the property the Ironwood pool
//! exists to provide.
//!
//! Whether that costs a vault its future post-quantum recovery is an open
//! question with the Zcash Foundation. Until it is answered, **do not claim
//! Quorum vaults are quantum-recoverable**, and say so in the submission.
//!
//! See `docs/12-spike-s1-report.md` §7.
//!
//! [zcash/orchard#475]: https://github.com/zcash/orchard/pull/475

use frost_core::keys::PublicKeyPackage;
use orchard::keys::{FullViewingKey, Scope, SpendValidatingKey, SpendingKey};
use rand_core::{CryptoRng, RngCore};

use crate::Ciphersuite;

/// Why a group key could not be turned into a Zcash vault identity.
#[derive(Debug, thiserror::Error)]
pub enum VaultKeyError {
    /// The FROST group verifying key is not a valid Orchard spend validating
    /// key.
    ///
    /// Orchard requires `ak` to be a non-identity Pallas point whose
    /// y-coordinate has a positive sign — the top bit of the last byte must be
    /// clear. A FROST group key is uniformly random, so roughly half of all
    /// DKG runs produce one Orchard rejects.
    ///
    /// This is recoverable by re-running key generation, and the caller must
    /// do so rather than surfacing it. A ceremony that fails half the time for
    /// reasons the participants cannot see is not a ceremony anyone will use.
    #[error(
        "FROST group verifying key is not a valid Orchard spend validating key \
         (likely a negative y-sign); re-run key generation"
    )]
    UnusableGroupKey,
}

/// A vault's Zcash identity, derived from the group key produced by DKG.
pub struct VaultKey {
    fvk: FullViewingKey,
}

impl VaultKey {
    /// Derives the vault identity from a completed DKG.
    ///
    /// `rng` supplies the throwaway spending key that fills `nk` and `rivk`.
    /// Nobody keeps it: it is not a spending key for this vault, and holding
    /// it would not let anyone spend, because authorization runs through `ak`,
    /// which is the FROST group key no single party controls.
    pub fn derive<R: RngCore + CryptoRng>(
        pubkeys: &PublicKeyPackage<Ciphersuite>,
        rng: &mut R,
    ) -> Result<Self, VaultKeyError> {
        let group_key = pubkeys
            .verifying_key()
            .serialize()
            .map_err(|_| VaultKeyError::UnusableGroupKey)?;
        let ak =
            SpendValidatingKey::from_bytes(&group_key).ok_or(VaultKeyError::UnusableGroupKey)?;

        // Rejection-sample a structurally valid spending key. Only nk and rivk
        // come from it; ak is already fixed by the group.
        let sk = loop {
            let mut bytes = [0u8; 32];
            rng.fill_bytes(&mut bytes);
            let candidate = SpendingKey::from_bytes(bytes);
            if candidate.is_some().into() {
                break candidate.unwrap();
            }
        };

        #[allow(deprecated)]
        let fvk =
            FullViewingKey::from_sk_ak_incompatible_with_quantum_recoverability_and_will_be_removed(
                &sk, ak,
            );

        Ok(Self { fvk })
    }

    /// The vault's full viewing key — grants visibility, never spend authority.
    ///
    /// Storing this server-side is an explicit, per-vault opt-in and must be
    /// encrypted at rest: it reveals the vault's entire transaction history.
    /// See `docs/03-architecture.md` §4.
    pub fn full_viewing_key(&self) -> &FullViewingKey {
        &self.fvk
    }

    /// The vault's receiving address at the default diversifier.
    pub fn address(&self) -> orchard::Address {
        self.fvk.address_at(0u32, Scope::External)
    }
}
