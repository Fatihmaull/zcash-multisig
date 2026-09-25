//! The coordinator as a service.
//!
//! Implements the integration contract in `apps/web/src/types/coordinator.ts`
//! so the web app can stop talking to a mock. Two surfaces, kept apart for
//! the reason the contract split them:
//!
//! - **`CoordinatorService`** — the browser's view. Creates requests, reads
//!   state, watches progress. **Cannot sign**, and there is no endpoint here
//!   that would let it.
//! - **`SignerService`** — the signer binary's view. Submits commitments and
//!   signature shares. This is the only surface that moves a round forward.
//!
//! # What this process holds
//!
//! Vault metadata, public key packages, approval state, commitments and
//! signature shares. **No key material.** Shares live on participants'
//! machines and never arrive here — below threshold the signature does not
//! exist, and that is mathematics rather than a permission check.
//!
//! # State is in memory
//!
//! Deliberately. The web app owns durable storage; this service owns the
//! live round. Restart it and in-flight rounds are lost, which is correct —
//! a half-collected round should not survive a restart, because the nonces
//! behind its commitments did not.

use std::collections::BTreeMap;
use std::sync::{Arc, Mutex};

use frost_core::keys::PublicKeyPackage;
use quorum_core::Ciphersuite;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::pczt_job::{self, PcztSigningJob};
use crate::round::{Action, CollectingCommitments, CollectingShares, CoordinatorError};

// ── Wire types — these mirror types/coordinator.ts exactly ───

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum ApprovalStatus {
    Pending,
    Approved,
    Rejected,
    Expired,
    Broadcasted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SignerState {
    Pending,
    Approved,
    Declined,
    Timeout,
    InvalidShare,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignerStatus {
    pub participant_id: String,
    pub participant_label: String,
    pub status: SignerState,
    /// ISO 8601. A string, never a Date — see the contract's note.
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SigningRoundEvent {
    pub id: String,
    pub approval_request_id: String,
    pub participant_id: String,
    pub participant_label: String,
    pub round_type: String,
    pub status: String,
    pub culprit_detected: bool,
    pub error_code: Option<String>,
    pub error_details: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequestState {
    pub id: String,
    pub vault_id: String,
    pub recipient_address: String,
    pub amount_zatoshi: String,
    pub memo: Option<String>,
    pub status: ApprovalStatus,
    pub txid: Option<String>,
    pub anchor_block: Option<u32>,
    /// Hex. Bound to this round; required to re-verify it afterwards.
    pub randomizer_seed_hex: Option<String>,
    pub threshold: u16,
    pub signatures_collected: usize,
    pub signer_statuses: Vec<SignerStatus>,
    pub events: Vec<SigningRoundEvent>,
    pub created_at: String,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SigningAction {
    pub pool: String,
    pub index: usize,
    pub alpha_hex: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SigningPackages {
    pub sighash_hex: String,
    pub actions: Vec<SigningAction>,
    pub signing_packages_hex: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoordinatorErrorBody {
    pub code: String,
    pub culprits: Option<Vec<String>>,
    pub recoverable: bool,
    pub message: String,
}

impl CoordinatorErrorBody {
    /// Map a protocol error onto the contract's taxonomy.
    ///
    /// Attribution survives the mapping. "Signing failed" tells a treasurer
    /// nothing; "Budi's share did not verify, and nothing was spent" tells
    /// them which device to look at.
    pub fn from_protocol(e: &CoordinatorError, labels: &BTreeMap<String, String>) -> Self {
        match e {
            CoordinatorError::InvalidShare { culprits, .. } => {
                let names: Vec<String> = culprits
                    .iter()
                    .map(|id| {
                        let hex = hex::encode(id.serialize());
                        labels.get(&hex).cloned().unwrap_or(hex)
                    })
                    .collect();
                let who = names.join(", ");
                Self {
                    code: "INVALID_SHARE".into(),
                    culprits: Some(names),
                    recoverable: true,
                    message: format!(
                        "Signature share rejected — {who}. The share does not verify against \
                         the commitment made in round 1. This vault has not been charged and \
                         no funds moved. Re-run the round without this signer, or investigate \
                         the device."
                    ),
                }
            }
            CoordinatorError::BelowThreshold { threshold, have } => Self {
                code: "THRESHOLD_NOT_MET".into(),
                culprits: None,
                recoverable: true,
                message: format!(
                    "{have} of {threshold} required approvals collected. Nothing has been \
                     signed or spent."
                ),
            },
            other => Self {
                code: "ROUND_ABORTED".into(),
                culprits: None,
                recoverable: false,
                message: other.to_string(),
            },
        }
    }
}

// ── Server state ─────────────────────────────────────────────

pub struct Participant {
    pub id: String,
    pub label: String,
    /// Proves a caller is this participant.
    ///
    /// Constraint C5 requires signing channels to be **authenticated**.
    /// Without this, `participantId` is a claim rather than a fact, and
    /// anyone who can reach the port could commit or submit shares as
    /// anybody — the round would still fail cryptographically, but the
    /// event log would blame the wrong person, and F4's whole value is
    /// blaming the right one.
    ///
    /// A bearer token is the floor, not the ceiling. Participants already
    /// hold an XEdDSA identity for `frostd` (see `quorum_core::transport`),
    /// and the production answer is a challenge-response against that key
    /// so nothing bearer-shaped is replayable. Tracked for Phase 5.
    pub token: String,
}

pub struct Vault {
    pub id: String,
    pub label: String,
    pub threshold: u16,
    pub address: String,
    pub pubkeys: PublicKeyPackage<Ciphersuite>,
    pub participants: Vec<Participant>,
}

impl Vault {
    /// Does this token belong to this participant?
    ///
    /// Comparison is not constant-time. Tokens are random 128-bit values
    /// rather than guessable secrets, so a timing oracle buys an attacker
    /// nothing meaningful — but the XEdDSA replacement should not repeat
    /// the shortcut.
    pub fn authenticate(&self, participant_id: &str, token: &str) -> bool {
        self.participants
            .iter()
            .any(|p| p.id == participant_id && p.token == token)
    }

    /// Identifier hex → human label, for turning FROST culprits into names.
    pub fn labels(&self) -> BTreeMap<String, String> {
        self.participants
            .iter()
            .map(|p| (p.id.clone(), p.label.clone()))
            .collect()
    }
}

/// Where a round currently is. Mirrors the typestate in `round.rs`; the
/// service needs a runtime enum because the phase is decided by traffic.
pub enum Phase {
    Commitments(CollectingCommitments),
    Shares(Box<CollectingShares>),
    Signed(Vec<[u8; 64]>),
    Failed,
}

pub struct Approval {
    pub state: ApprovalRequestState,
    pub job: PcztSigningJob,
    pub pczt: Vec<u8>,
    pub phase: Phase,
    /// Seconds before an unresponsive signer is marked TIMEOUT.
    pub signer_deadline_secs: u64,
    pub opened_at: std::time::Instant,
}

#[derive(Default)]
pub struct Inner {
    pub vaults: BTreeMap<String, Vault>,
    pub approvals: BTreeMap<String, Approval>,
}

#[derive(Clone, Default)]
pub struct AppState(pub Arc<Mutex<Inner>>);

impl AppState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a vault produced by a key ceremony.
    ///
    /// Takes the **public** key package only. If this signature ever needs a
    /// share to work, something has gone badly wrong.
    pub fn add_vault(&self, vault: Vault) -> String {
        let id = vault.id.clone();
        self.0
            .lock()
            .expect("state lock")
            .vaults
            .insert(id.clone(), vault);
        id
    }
}

pub fn now_iso() -> String {
    // ISO 8601 with second precision. The contract says strings, never Dates.
    let d = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("clock is after 1970");
    let secs = d.as_secs() as i64;
    let days = secs / 86_400;
    let rem = secs % 86_400;
    let (y, m, dd) = civil_from_days(days);
    format!(
        "{y:04}-{m:02}-{dd:02}T{:02}:{:02}:{:02}Z",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

/// Howard Hinnant's civil-from-days. Avoids pulling a date crate for one call.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

/// Build a signing job from a PCZT the wallet produced.
pub fn job_from_pczt(pczt: &[u8]) -> Result<PcztSigningJob, pczt_job::PcztError> {
    pczt_job::inspect(pczt)
}

pub fn actions_to_wire(actions: &[Action]) -> Vec<SigningAction> {
    actions
        .iter()
        .map(|a| SigningAction {
            pool: match a.pool {
                crate::round::ShieldedPool::Ironwood => "IRONWOOD".into(),
                crate::round::ShieldedPool::Orchard => "ORCHARD".into(),
            },
            index: a.index,
            alpha_hex: hex::encode(a.alpha),
        })
        .collect()
}
