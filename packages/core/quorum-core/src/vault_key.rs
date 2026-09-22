//! Deriving a vault's Zcash identity from a FROST group key.
//!
//! A FROST group has a verifying key but no spending key — nobody holds one,
//! which is the entire point. Zcash still needs a full viewing key to produce
//! an address and to scan for notes. This module bridges the two.
//!
//! # The vault seed is a shared secret, and it must be kept
//!
//! `ak` comes from FROST. `nk` and `rivk` do not — they come from a spending
//! key generated once at the ceremony. That key cannot spend anything here
//! (spend authorization runs through `ak`, which no single party controls),
//! but it **is** what makes the vault's notes findable and its nullifiers
//! computable.
//!
//! So it has to be generated once and shared with every participant, over
//! the same confidential channel the DKG uses. Two ways of getting this
//! wrong, both fatal:
//!
//! - **Generate it per call.** Every derivation yields a different address,
//!   and funds sent to one are unreachable forever. Caught the hard way, on
//!   testnet, with real notes.
//! - **Derive it from the group key.** Tempting — no extra state to
//!   distribute — and catastrophic. `ak` is embedded in the address, so
//!   anyone who knows the address could reconstruct the viewing key and
//!   decrypt every transaction the vault ever makes. It would turn a
//!   shielded vault into a public ledger.
//!
//! Hence [`VaultSeed`]: generated once, distributed confidentially, stored
//! with each share.
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

    /// No valid Orchard spending key found near this seed.
    ///
    /// Astronomically unlikely — 256 consecutive rejections. Treated as an
    /// error rather than a panic because a custody tool should not abort on
    /// input it can report on.
    #[error("no valid Orchard spending key derivable from this vault seed")]
    UnusableSeed,
}

/// The secret that fixes a vault's viewing identity.
///
/// Not a spending key for the vault — it authorizes nothing, because spending
/// runs through the FROST group key. But it determines `nk` and `rivk`, so
/// whoever holds it can see the vault's transactions, and whoever lacks it
/// cannot find the vault's notes at all.
///
/// Generate once per vault, distribute to every participant over the
/// confidential channel, and store it beside the share.
#[derive(Clone)]
pub struct VaultSeed([u8; 32]);

impl VaultSeed {
    /// Draw a fresh seed. Call this **once**, during the ceremony.
    pub fn generate<R: RngCore + CryptoRng>(rng: &mut R) -> Self {
        let mut bytes = [0u8; 32];
        rng.fill_bytes(&mut bytes);
        Self(bytes)
    }

    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }
}

impl std::fmt::Debug for VaultSeed {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Never print it. It is the difference between a shielded vault and
        // a public one.
        f.write_str("VaultSeed(<redacted>)")
    }
}

/// A vault's Zcash identity, derived from the group key produced by DKG.
pub struct VaultKey {
    fvk: FullViewingKey,
}

impl VaultKey {
    /// Derives the vault identity from a completed DKG and its seed.
    ///
    /// **Deterministic.** The same `pubkeys` and `seed` always produce the
    /// same address — which is the entire point. An earlier version drew the
    /// seed internally, so every call produced a different vault and any
    /// funds sent to one were unreachable.
    pub fn derive(
        pubkeys: &PublicKeyPackage<Ciphersuite>,
        seed: &VaultSeed,
    ) -> Result<Self, VaultKeyError> {
        let group_key = pubkeys
            .verifying_key()
            .serialize()
            .map_err(|_| VaultKeyError::UnusableGroupKey)?;
        let ak =
            SpendValidatingKey::from_bytes(&group_key).ok_or(VaultKeyError::UnusableGroupKey)?;

        // Only nk and rivk come from this; ak is already fixed by the group.
        //
        // Derived deterministically by counter from the seed, so a seed that
        // happens not to be a structurally valid SpendingKey still yields one
        // vault identity rather than none. Rejection sampling with fresh
        // randomness would break determinism, which is the bug this replaces.
        let sk = {
            let mut candidate = None;
            for counter in 0u8..=255 {
                let mut bytes = *seed.as_bytes();
                bytes[31] ^= counter;
                let sk = SpendingKey::from_bytes(bytes);
                if sk.is_some().into() {
                    candidate = Some(sk.unwrap());
                    break;
                }
            }
            candidate.ok_or(VaultKeyError::UnusableSeed)?
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
