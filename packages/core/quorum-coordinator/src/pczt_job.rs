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

use ff::PrimeField;
use orchard::keys::SpendValidatingKey;
use orchard::pczt::Bundle;
use pasta_curves::pallas;
use pczt::roles::low_level_signer::{OrchardParseError, Signer as LowLevelSigner};
use pczt::roles::signer::Signer as SighashSigner;
use pczt::Pczt;

use crate::round::{Action, ShieldedPool};

#[derive(Debug, thiserror::Error)]
pub enum PcztError {
    #[error("could not parse the PCZT: {0}")]
    Parse(String),

    #[error("pczt rejected the operation: {0}")]
    Pczt(String),

    /// No spend in this transaction is waiting for a signature.
    ///
    /// Not "nothing to do". A v6 transaction carries both an Orchard and an
    /// Ironwood bundle, and querying the wrong one returns success with an
    /// empty list — so an empty result is far more likely to mean we looked
    /// in the wrong place than that the wallet handed us a transaction with
    /// nothing to authorize.
    #[error(
        "no unsigned shielded spends found — wrong bundle, or a transaction with nothing to sign"
    )]
    NoSpends,

    /// A spend is awaiting signature but carries no randomizer.
    ///
    /// Unsignable: without alpha there is no way to know which randomized key
    /// the signature must verify against.
    #[error("action {0} is unsigned but has no randomizer")]
    MissingAlpha(usize),

    #[error("expected a signature for action {0}, none supplied")]
    MissingSignature(usize),

    /// The transaction does not belong to this vault.
    ///
    /// Each action carries `rk`, the randomized key its signature must verify
    /// against. For a vault, `rk` must equal the group's `ak` randomized by
    /// that action's own `alpha`. When it does not, the PCZT was built for a
    /// different vault — and this is the failure that does **not** announce
    /// itself: the signers are handed alphas from the transaction, so FROST
    /// completes happily, aggregation succeeds, and the coordinator reports a
    /// quorum. The signature is valid. It authorizes nothing.
    ///
    /// Checked before any signer is asked to commit, because a participant
    /// who has committed has burned a nonce.
    #[error(
        "action {index} belongs to a different vault: its rk is not this vault's ak randomized \
         by the action's own alpha. Signing it would produce a valid FROST signature that \
         authorizes nothing on chain. Check that the PCZT and the vault are the same vault."
    )]
    WrongVault { index: usize },

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

/// One unsigned spend, as the transaction describes itself.
///
/// Both fields are public data carried by the transaction. Together they say
/// *which vault* must authorize this spend: `rk` is that vault's `ak`
/// randomized by `alpha`, so a vault can check whether a transaction is its
/// business without holding anything secret.
#[derive(Debug, Clone)]
pub struct SpendDescriptor {
    pub pool: ShieldedPool,
    pub index: usize,
    /// The spend authorization randomizer the wallet fixed.
    pub alpha: [u8; 32],
    /// The randomized validating key the signature must verify against.
    pub rk: [u8; 32],
}

/// Everything the FROST rounds need from a transaction.
pub struct PcztSigningJob {
    /// The message every action signs over. One sighash, N signatures.
    pub sighash: [u8; 32],
    /// One entry per spend still awaiting authorization.
    pub actions: Vec<Action>,
}

/// Read the sighash and the unsigned spends out of a PCZT.
///
/// `vault_ak` is the vault's spend validating key — the FROST group verifying
/// key, read as an Orchard `ak`. Every action is checked against it before
/// anything is returned, so a PCZT belonging to another vault is rejected here
/// rather than discovered on chain. See [`PcztError::WrongVault`].
pub fn inspect(
    pczt_bytes: &[u8],
    vault_ak: &SpendValidatingKey,
) -> Result<PcztSigningJob, PcztError> {
    let pczt = Pczt::parse(pczt_bytes).map_err(|e| PcztError::Parse(format!("{e:?}")))?;

    // The sighash covers the whole transaction, so it is the same for every
    // action — which is why a signer can commit to all of them in one round 1.
    let sighash = SighashSigner::new(pczt.clone())
        .map_err(|e| PcztError::Pczt(format!("{e:?}")))?
        .shielded_sighash();

    let spends = walk(&pczt)?;
    if spends.is_empty() {
        return Err(PcztError::NoSpends);
    }

    // The binding check. `alpha` alone tells us which randomized key to sign
    // under, but not whose. `rk` tells us whose, and both are already in the
    // transaction — so this costs nothing and catches the one mistake FROST
    // cannot: signing a stranger's transaction with our vault's shares,
    // successfully. Done before anything is returned, because a participant
    // who has committed has burned a nonce.
    let mut actions = Vec::with_capacity(spends.len());
    for spend in spends {
        let alpha = pallas::Scalar::from_repr(spend.alpha)
            .into_option()
            .ok_or(PcztError::MissingAlpha(spend.index))?;
        let expected: [u8; 32] = (&vault_ak.randomize(&alpha)).into();
        if spend.rk != expected {
            return Err(PcztError::WrongVault { index: spend.index });
        }
        actions.push(Action {
            pool: spend.pool,
            index: spend.index,
            alpha: spend.alpha,
        });
    }

    Ok(PcztSigningJob { sighash, actions })
}

/// Every unsigned spend, described but not judged.
///
/// [`inspect`] is this plus the binding check. Exposed separately because
/// "which vault is this transaction for?" is a useful question to be able to
/// ask before you have an answer — see `examples/which_vault.rs` — and
/// because a test needs to build a transaction that binds to the vault it
/// just generated.
pub fn spend_keys(pczt_bytes: &[u8]) -> Result<Vec<SpendDescriptor>, PcztError> {
    let pczt = Pczt::parse(pczt_bytes).map_err(|e| PcztError::Parse(format!("{e:?}")))?;
    walk(&pczt)
}

fn walk(pczt: &Pczt) -> Result<Vec<SpendDescriptor>, PcztError> {
    let mut spends = Vec::new();
    for (pool, tag) in [
        (ShieldedPool::Ironwood, "ironwood"),
        (ShieldedPool::Orchard, "orchard"),
    ] {
        collect(pczt, pool, tag, &mut spends)?;
    }
    Ok(spends)
}

/// Walk one bundle and record every spend still lacking a signature.
fn collect(
    pczt: &Pczt,
    pool: ShieldedPool,
    tag: &str,
    out: &mut Vec<SpendDescriptor>,
) -> Result<(), PcztError> {
    let mut found: Vec<SpendDescriptor> = Vec::new();

    let read = |_p: &Pczt, bundle: &mut Bundle, _n: &mut u8| -> Result<(), PcztError> {
        for (index, action) in bundle.actions_mut().iter().enumerate() {
            // A dummy spend is already signed by the IO finalizer during
            // `pczt create`; only real spends still need us.
            if action.spend().spend_auth_sig().is_some() {
                continue;
            }
            let alpha = match action.spend().alpha() {
                Some(alpha) => alpha,
                None => return Err(PcztError::MissingAlpha(index)),
            };
            found.push(SpendDescriptor {
                pool,
                index,
                alpha: alpha.to_repr(),
                rk: action.spend().rk().into(),
            });
        }
        Ok(())
    };

    let signer = LowLevelSigner::new(pczt.clone());
    let outcome = match pool {
        ShieldedPool::Ironwood => signer.sign_ironwood_with(read),
        ShieldedPool::Orchard => signer.sign_orchard_with(read),
    };

    outcome.map_err(|e| match e {
        PcztError::BundleAccess(inner) => {
            PcztError::Pczt(format!("could not read the {tag} bundle: {inner:?}"))
        }
        other => other,
    })?;
    out.extend(found);
    Ok(())
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
