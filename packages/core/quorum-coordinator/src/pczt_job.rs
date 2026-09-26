//! Turning a PCZT into a signing job, and putting the signatures back.
//!
//! The coordinator never builds the transaction — a wallet does that, and
//! hands us a PCZT with unsigned shielded spends. Our job is narrow:
//!
//! 1. read the sighash and each unsigned spend's randomizer,
//! 2. hand those to the FROST rounds,
//! 3. apply the resulting 64-byte signatures back onto the actions.
//!
//! # Why this is not `Signer::sign_ironwood`
//!
//! `pczt`'s ordinary signer wants a `SpendAuthorizingKey` — a single secret
//! that authorizes the spend. **No such key exists here.** That is the entire
//! point of the vault: authority is split across participants and never
//! assembled. So we use the low-level role, which lets an *external* signer
//! produce the signature and hand it back. Same pattern the Zcash
//! Foundation's own `zcash-sign` uses.
//!
//! # The randomizer comes from here, not from FROST
//!
//! Each action carries its own `alpha`, fixed when the wallet built the
//! transaction. FROST v3 would happily derive a randomizer of its own; using
//! it would produce a signature that verifies under FROST and authorizes
//! nothing on chain. Read `alpha` out of the action, always.

use orchard::keys::SpendValidatingKey;
use orchard::pczt::Bundle;
use pczt::roles::low_level_signer::{OrchardParseError, Signer as LowLevelSigner};
use pczt::roles::signer::Signer as SighashSigner;
use pczt::Pczt;

use crate::round::{Action, ShieldedPool};

#[derive(Debug, thiserror::Error)]
pub enum PcztError {
    /// Reading the transaction failed, or it does not belong to this vault.
    ///
    /// Not flattened to a string: `WrongVault` and `SighashMismatch` are the
    /// two an operator needs to be able to tell apart from a parse failure.
    #[error(transparent)]
    Transaction(#[from] quorum_core::transaction::TransactionError),

    #[error("could not parse the PCZT: {0}")]
    Parse(String),

    #[error("pczt rejected the operation: {0}")]
    Pczt(String),

    #[error("expected a signature for action {0}, none supplied")]
    MissingSignature(usize),

    /// The low-level signer could not read or write the bundle.
    ///
    /// `SigningClosureModifiedActions` is the one worth noticing: pczt checks
    /// that a signing closure changed nothing but signatures. If we ever trip
    /// it, we are mutating a transaction someone else already agreed to.
    #[error("bundle access failed: {0:?}")]
    BundleAccess(OrchardParseError),
}

impl From<OrchardParseError> for PcztError {
    fn from(e: OrchardParseError) -> Self {
        PcztError::BundleAccess(e)
    }
}

/// Re-exported: reading a transaction is shared with the signer.
pub use quorum_core::transaction::SpendDescriptor;

/// Everything the FROST rounds need from a transaction.
pub struct PcztSigningJob {
    /// The message every action signs over. One sighash, N signatures.
    pub sighash: [u8; 32],
    /// One entry per spend still awaiting authorization.
    pub actions: Vec<Action>,
}

/// Read the sighash and the unsigned spends out of a PCZT, for this vault.
///
/// Delegates to [`quorum_core::transaction::summarize`], which is also what a
/// signer calls. That is the point: before this was shared, the coordinator
/// was the only party that ever read a transaction, and a signer had no way
/// to know whether the sighash it was handed belonged to the transaction it
/// was told about.
pub fn inspect(
    pczt_bytes: &[u8],
    vault_ak: &SpendValidatingKey,
) -> Result<PcztSigningJob, PcztError> {
    let summary = quorum_core::transaction::summarize(pczt_bytes, vault_ak)?;
    Ok(PcztSigningJob {
        sighash: summary.sighash,
        actions: summary
            .spends
            .into_iter()
            .map(|s| Action {
                pool: s.pool,
                index: s.index,
                alpha: s.alpha,
            })
            .collect(),
    })
}

/// Every unsigned spend, described but not judged.
pub fn spend_keys(pczt_bytes: &[u8]) -> Result<Vec<SpendDescriptor>, PcztError> {
    Ok(quorum_core::transaction::spend_keys(pczt_bytes)?)
}

/// Apply threshold signatures and return the updated PCZT.
///
/// `signatures` must line up with [`PcztSigningJob::actions`] — same order,
/// one 64-byte RedPallas signature each. A transaction is authorized in full
/// or not at all: a partially signed one is rejected by the node with nothing
/// local to explain it.
pub fn apply(
    pczt_bytes: &[u8],
    actions: &[Action],
    signatures: &[[u8; 64]],
) -> Result<Vec<u8>, PcztError> {
    if signatures.len() != actions.len() {
        return Err(PcztError::MissingSignature(signatures.len()));
    }
    let pczt = Pczt::parse(pczt_bytes).map_err(|e| PcztError::Parse(format!("{e:?}")))?;
    let sighash = SighashSigner::new(pczt.clone())
        .map_err(|e| PcztError::Pczt(format!("{e:?}")))?
        .shielded_sighash();

    let mut signer = LowLevelSigner::new(pczt);

    for pool in [ShieldedPool::Ironwood, ShieldedPool::Orchard] {
        let todo: Vec<(usize, [u8; 64])> = actions
            .iter()
            .zip(signatures.iter())
            .filter(|(a, _)| a.pool == pool)
            .map(|(a, s)| (a.index, *s))
            .collect();
        if todo.is_empty() {
            continue;
        }

        let write = |_p: &Pczt, bundle: &mut Bundle, _n: &mut u8| -> Result<(), PcztError> {
            for (index, sig) in &todo {
                let signature = orchard::primitives::redpallas::Signature::from(*sig);
                let action = bundle
                    .actions_mut()
                    .get_mut(*index)
                    .ok_or(PcztError::MissingSignature(*index))?;
                action
                    .apply_signature(sighash, signature)
                    .map_err(|e| PcztError::Pczt(format!("{e:?}")))?;
            }
            Ok(())
        };

        signer = match pool {
            ShieldedPool::Ironwood => signer.sign_ironwood_with(write),
            ShieldedPool::Orchard => signer.sign_orchard_with(write),
        }?;
    }

    signer
        .finish()
        .serialize()
        .map_err(|e| PcztError::Pczt(format!("could not serialise the signed PCZT: {e:?}")))
}
