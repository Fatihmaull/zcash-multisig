//! Reading a transaction, so that both sides can read the same one.
//!
//! This module exists because of a hole. The coordinator used to be the only
//! party that ever parsed a PCZT: it read the sighash and the per-action
//! randomizers and handed those to the signers, who signed what they were
//! given. A compromised coordinator could therefore serve the sighash of a
//! *different* transaction spending the same vault, collect a valid threshold
//! signature over it, and move the funds. Every share would verify.
//! Aggregation would succeed. **No signer could tell.**
//!
//! The coordinator's own binding check does not help, because it runs on the
//! coordinator — the party that scenario is about.
//!
//! So reading lives here, in the crate both the coordinator and the signer
//! depend on, and a signer derives the sighash from the transaction itself
//! rather than accepting one. Writing signatures back is still the
//! coordinator's job and stays there.
//!
//! # What a signer can and cannot check
//!
//! **Can:** that the sighash is this transaction's sighash; that each
//! randomizer is the one the transaction fixed; and that every action's `rk`
//! is *its own vault's* `ak` randomized by that action's `alpha` — which
//! proves the transaction spends from the vault this signer holds a share of,
//! and nothing else.
//!
//! **Cannot, in general:** what the transaction pays and to whom. A shielded
//! output is encrypted to its recipient. PCZT carries optional plaintext
//! `recipient` and `value` fields precisely so signers can check, but they
//! are optional and may be redacted. When they are absent, the honest answer
//! is that we do not know — not a figure supplied by the coordinator, which
//! would be the same trust we are trying to remove.

use ff::PrimeField;
use orchard::keys::SpendValidatingKey;
use orchard::pczt::Bundle;
use pasta_curves::pallas;
use pczt::roles::low_level_signer::{OrchardParseError, Signer as LowLevelSigner};
use pczt::roles::signer::Signer as SighashSigner;
use pczt::Pczt;

/// Which shielded pool an action belongs to.
///
/// A v6 transaction carries both bundles, and asking the wrong one returns
/// success with zero spends rather than an error — so an empty result is far
/// more likely to mean we looked in the wrong place.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ShieldedPool {
    Orchard,
    Ironwood,
}

#[derive(Debug, thiserror::Error)]
pub enum TransactionError {
    #[error("could not parse the PCZT: {0}")]
    Parse(String),

    #[error("pczt rejected the operation: {0}")]
    Pczt(String),

    /// No spend in this transaction is waiting for a signature.
    #[error(
        "no unsigned shielded spends found — wrong bundle, or a transaction with nothing to sign"
    )]
    NoSpends,

    /// A spend is awaiting signature but carries no randomizer.
    #[error("action {0} is unsigned but has no randomizer")]
    MissingAlpha(usize),

    /// The transaction does not spend from this vault.
    ///
    /// `rk` is the key an action's signature must verify against, and for a
    /// vault it must equal the group's `ak` randomized by that action's own
    /// `alpha`. Both are public, so this costs nothing to check and catches
    /// the one mistake FROST cannot: signing a stranger's transaction with
    /// our vault's shares, successfully.
    #[error(
        "action {index} does not spend from this vault: its rk is not this vault's ak randomized \
         by the action's own alpha. Signing it would produce a valid FROST signature that \
         authorizes nothing on chain"
    )]
    WrongVault { index: usize },

    /// The sighash we were asked to sign is not this transaction's sighash.
    ///
    /// For a signer this is the alarm, not a mismatch to reconcile: someone
    /// asked us to authorize something other than the transaction we were
    /// shown.
    #[error(
        "the sighash offered does not match this transaction.\n  offered {offered}\n  \
         actual  {actual}\nRefusing to sign. Whoever asked for this signature is not asking \
         about the transaction they showed us."
    )]
    SighashMismatch { offered: String, actual: String },

    /// A randomizer we were given is not the one the transaction fixed.
    #[error(
        "action {index}: the randomizer offered is not the one this transaction fixed. A \
         signature under the wrong randomizer verifies under FROST and authorizes nothing"
    )]
    AlphaMismatch { index: usize },

    #[error("bundle access failed: {0:?}")]
    BundleAccess(OrchardParseError),
}

impl From<OrchardParseError> for TransactionError {
    fn from(e: OrchardParseError) -> Self {
        TransactionError::BundleAccess(e)
    }
}

/// One unsigned spend, as the transaction describes itself.
///
/// Every field is public data carried by the transaction.
#[derive(Debug, Clone)]
pub struct SpendDescriptor {
    pub pool: ShieldedPool,
    pub index: usize,
    /// The spend authorization randomizer the wallet fixed.
    pub alpha: [u8; 32],
    /// The randomized validating key the signature must verify against.
    pub rk: [u8; 32],
}

/// What a participant can honestly say a transaction does.
///
/// Amounts and recipients are `None` when the PCZT does not carry them in the
/// clear. That is a real answer and it is reported as one; the alternative —
/// displaying a figure the coordinator supplied — is the trust this module
/// exists to remove.
#[derive(Debug, Clone)]
pub struct Summary {
    pub sighash: [u8; 32],
    pub spends: Vec<SpendDescriptor>,
    pub outputs: Vec<OutputSummary>,
}

#[derive(Debug, Clone)]
pub struct OutputSummary {
    pub pool: ShieldedPool,
    pub index: usize,
    /// Zatoshis, if the transaction states them.
    pub value: Option<u64>,
    /// True when the PCZT names a recipient address in the clear.
    pub recipient_known: bool,
}

/// The message every action in this transaction signs over.
pub fn sighash(pczt_bytes: &[u8]) -> Result<[u8; 32], TransactionError> {
    let pczt = Pczt::parse(pczt_bytes).map_err(|e| TransactionError::Parse(format!("{e:?}")))?;
    Ok(SighashSigner::new(pczt)
        .map_err(|e| TransactionError::Pczt(format!("{e:?}")))?
        .shielded_sighash())
}

/// Every unsigned spend, described but not judged.
pub fn spend_keys(pczt_bytes: &[u8]) -> Result<Vec<SpendDescriptor>, TransactionError> {
    let pczt = Pczt::parse(pczt_bytes).map_err(|e| TransactionError::Parse(format!("{e:?}")))?;
    walk(&pczt)
}

/// Read a transaction and check it belongs to this vault.
///
/// `vault_ak` is the FROST group verifying key read as an Orchard `ak`. Every
/// action is checked before anything is returned, so a transaction belonging
/// to another vault is refused here rather than discovered on chain.
pub fn summarize(
    pczt_bytes: &[u8],
    vault_ak: &SpendValidatingKey,
) -> Result<Summary, TransactionError> {
    let pczt = Pczt::parse(pczt_bytes).map_err(|e| TransactionError::Parse(format!("{e:?}")))?;
    let sighash = SighashSigner::new(pczt.clone())
        .map_err(|e| TransactionError::Pczt(format!("{e:?}")))?
        .shielded_sighash();

    let spends = walk(&pczt)?;
    if spends.is_empty() {
        return Err(TransactionError::NoSpends);
    }
    for spend in &spends {
        let alpha = scalar(spend.alpha).ok_or(TransactionError::MissingAlpha(spend.index))?;
        let expected: [u8; 32] = (&vault_ak.randomize(&alpha)).into();
        if spend.rk != expected {
            return Err(TransactionError::WrongVault { index: spend.index });
        }
    }

    let outputs = outputs(&pczt)?;
    Ok(Summary {
        sighash,
        spends,
        outputs,
    })
}

/// A signer's check: is this the transaction we were asked to sign?
///
/// `offered_sighash` and `offered_alphas` are what the coordinator said. This
/// recomputes both from the transaction and refuses on any disagreement. The
/// `alphas` are matched by position against the actions in bundle order,
/// which is the order [`summarize`] returns and the order the coordinator
/// sends.
pub fn verify_offer(
    pczt_bytes: &[u8],
    vault_ak: &SpendValidatingKey,
    offered_sighash: &[u8; 32],
    offered_alphas: &[[u8; 32]],
) -> Result<Summary, TransactionError> {
    let summary = summarize(pczt_bytes, vault_ak)?;

    if &summary.sighash != offered_sighash {
        return Err(TransactionError::SighashMismatch {
            offered: hex::encode(offered_sighash),
            actual: hex::encode(summary.sighash),
        });
    }

    for (i, spend) in summary.spends.iter().enumerate() {
        match offered_alphas.get(i) {
            Some(offered) if offered == &spend.alpha => {}
            _ => return Err(TransactionError::AlphaMismatch { index: spend.index }),
        }
    }
    if offered_alphas.len() != summary.spends.len() {
        return Err(TransactionError::AlphaMismatch {
            index: summary.spends.len(),
        });
    }

    Ok(summary)
}

fn scalar(bytes: [u8; 32]) -> Option<pallas::Scalar> {
    pallas::Scalar::from_repr(bytes).into_option()
}

fn walk(pczt: &Pczt) -> Result<Vec<SpendDescriptor>, TransactionError> {
    let mut out = Vec::new();
    for (pool, tag) in [
        (ShieldedPool::Ironwood, "ironwood"),
        (ShieldedPool::Orchard, "orchard"),
    ] {
        let mut found: Vec<SpendDescriptor> = Vec::new();
        let read = |_p: &Pczt, bundle: &mut Bundle, _n: &mut u8| -> Result<(), TransactionError> {
            for (index, action) in bundle.actions_mut().iter().enumerate() {
                // A dummy spend is already signed by the IO finalizer during
                // `pczt create`; only real spends still need us.
                if action.spend().spend_auth_sig().is_some() {
                    continue;
                }
                let alpha = match action.spend().alpha() {
                    Some(alpha) => alpha,
                    None => return Err(TransactionError::MissingAlpha(index)),
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
        run(pczt, pool, tag, read)?;
        out.extend(found);
    }
    Ok(out)
}

fn outputs(pczt: &Pczt) -> Result<Vec<OutputSummary>, TransactionError> {
    let mut out = Vec::new();
    for (pool, tag) in [
        (ShieldedPool::Ironwood, "ironwood"),
        (ShieldedPool::Orchard, "orchard"),
    ] {
        let mut found: Vec<OutputSummary> = Vec::new();
        let read = |_p: &Pczt, bundle: &mut Bundle, _n: &mut u8| -> Result<(), TransactionError> {
            for (index, action) in bundle.actions_mut().iter().enumerate() {
                found.push(OutputSummary {
                    pool,
                    index,
                    value: action.output().value().map(|v| v.inner()),
                    recipient_known: action.output().recipient().is_some(),
                });
            }
            Ok(())
        };
        run(pczt, pool, tag, read)?;
        out.extend(found);
    }
    Ok(out)
}

/// Run a read-only closure against one pool's bundle.
fn run<F>(pczt: &Pczt, pool: ShieldedPool, tag: &str, read: F) -> Result<(), TransactionError>
where
    F: FnOnce(&Pczt, &mut Bundle, &mut u8) -> Result<(), TransactionError>,
{
    let signer = LowLevelSigner::new(pczt.clone());
    let outcome = match pool {
        ShieldedPool::Ironwood => signer.sign_ironwood_with(read),
        ShieldedPool::Orchard => signer.sign_orchard_with(read),
    };
    outcome.map(|_| ()).map_err(|e| match e {
        TransactionError::BundleAccess(inner) => {
            TransactionError::Pczt(format!("could not read the {tag} bundle: {inner:?}"))
        }
        other => other,
    })
}
