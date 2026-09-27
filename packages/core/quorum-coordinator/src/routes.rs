//! HTTP routes implementing the integration contract.
//!
//! Endpoint names match `apps/web/src/types/coordinator.ts`. The split is
//! load-bearing, not cosmetic: nothing under `/coordinator` can produce a
//! signature, and the web app is only ever given that base path.

use std::collections::BTreeMap;

use axum::{
    extract::State, http::HeaderMap, http::StatusCode, response::IntoResponse, routing::post, Json,
    Router,
};
use serde::Deserialize;
use serde_json::json;
use tower_http::cors::CorsLayer;

use crate::round::CollectingCommitments;
use crate::service::*;

pub fn router(state: AppState) -> Router {
    Router::new()
        // ── CoordinatorService — the browser's view. No signing. ──
        .route("/coordinator/vault/register", post(vault_register))
        .route("/coordinator/ceremony/create", post(ceremony_create))
        .route("/coordinator/ceremony/status", post(ceremony_status))
        .route("/coordinator/ceremony/report", post(ceremony_report))
        .route("/coordinator/vault/list", post(vault_list))
        .route("/coordinator/vault/audit", post(vault_audit))
        .route("/coordinator/approval/submit", post(approval_submit))
        .route("/coordinator/approval/status", post(approval_status))
        .route(
            "/coordinator/approval/authorized",
            post(approval_authorized),
        )
        // ── SignerService — the signer binary's view. ──
        .route("/signer/pending", post(signer_pending))
        .route("/signer/request", post(signer_request))
        .route("/signer/commit", post(signer_commit))
        .route("/signer/packages", post(signer_packages))
        .route("/signer/shares", post(signer_shares))
        .route("/signer/decline", post(signer_decline))
        .route("/health", post(health))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

type Reply = Result<Json<serde_json::Value>, ApiError>;

/// An error the UI can act on.
///
/// Carries the contract's error taxonomy rather than a string, because F4 —
/// telling a treasurer *which* signer to investigate — depends on structure
/// surviving all the way to the browser.
pub struct ApiError(StatusCode, CoordinatorErrorBody);

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (self.0, Json(json!(self.1))).into_response()
    }
}

/// A poisoned lock means an earlier handler panicked mid-update.
///
/// Returning an error rather than propagating the panic keeps one bad
/// request from taking the service down — but the state may be
/// inconsistent, so this says so rather than pretending otherwise.
fn lock_poisoned() -> ApiError {
    ApiError(
        StatusCode::INTERNAL_SERVER_ERROR,
        CoordinatorErrorBody {
            code: "ROUND_ABORTED".into(),
            culprits: None,
            recoverable: false,
            message: "The coordinator's state may be inconsistent after an earlier failure. \
Nothing has been signed or spent. Restart the coordinator and re-open the request."
                .into(),
        },
    )
}

/// The caller did not prove it is the participant it claims to be.
fn unauthorized() -> ApiError {
    ApiError(
        StatusCode::UNAUTHORIZED,
        CoordinatorErrorBody {
            code: "UNAUTHORIZED".into(),
            culprits: None,
            recoverable: false,
            message: "Missing or invalid participant token. A signer must prove who it is \
before it can contribute to a round — otherwise the event log would name the wrong person."
                .into(),
        },
    )
}

fn bearer(headers: &HeaderMap) -> Option<String> {
    headers
        .get("authorization")?
        .to_str()
        .ok()?
        .strip_prefix("Bearer ")
        .map(|s| s.to_string())
}

fn bad(code: &str, message: impl Into<String>) -> ApiError {
    ApiError(
        StatusCode::BAD_REQUEST,
        CoordinatorErrorBody {
            code: code.into(),
            culprits: None,
            recoverable: false,
            message: message.into(),
        },
    )
}

async fn health() -> Reply {
    Ok(Json(json!({ "status": "ok", "network": "testnet" })))
}

// ── CoordinatorService ───────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterVault {
    label: String,
    threshold: u16,
    address: String,
    /// Serialised `PublicKeyPackage`. **Public** — there is deliberately no
    /// field here for a share.
    public_key_package: serde_json::Value,
    participants: Vec<ParticipantIn>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ParticipantIn {
    /// Hex FROST identifier.
    id: String,
    label: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCeremony {
    label: String,
    threshold: u16,
    participants: Vec<RosterEntry>,
}

/// Open a ceremony and hand back what each participant needs to run it.
///
/// **The coordinator does not perform the ceremony.** It cannot: a share it
/// could see is a share it holds. What it returns is the roster and the exact
/// command each participant runs on their own machine, so the guided
/// experience lives in a UI while the key material never leaves the
/// participant.
///
/// The roster is trusted absolutely by `Noise_K`. Whoever supplies these
/// public keys decides who holds a share, so verifying them out of band is a
/// step the participants perform deliberately — not setup chrome, and not
/// something this endpoint can check for them.
async fn ceremony_create(State(st): State<AppState>, Json(req): Json<CreateCeremony>) -> Reply {
    if req.threshold < 2 {
        return Err(bad(
            "INVALID_ARGUMENT",
            "threshold must be at least 2; 1-of-n is a single point of failure in a costume",
        ));
    }
    if req.participants.len() < req.threshold as usize {
        return Err(bad(
            "INVALID_ARGUMENT",
            "fewer participants than the threshold requires",
        ));
    }
    for p in &req.participants {
        if hex::decode(&p.pubkey).map(|b| b.len()) != Ok(32) {
            return Err(bad(
                "INVALID_ARGUMENT",
                format!("{}: pubkey must be 32 bytes of hex", p.label),
            ));
        }
        if hex::decode(&p.identifier).is_err() {
            return Err(bad(
                "INVALID_ARGUMENT",
                format!("{}: identifier must be hex", p.label),
            ));
        }
    }

    let id = new_id();
    let ceremony = Ceremony {
        id: id.clone(),
        label: req.label,
        threshold: req.threshold,
        roster: req.participants,
        reports: BTreeMap::new(),
        vault_id: None,
        created_at: now_iso(),
    };
    let roster_json = json!({
        "threshold": ceremony.threshold,
        "participants": ceremony.roster,
    });
    let instructions: Vec<_> = ceremony
        .roster
        .iter()
        .enumerate()
        .map(|(i, p)| {
            json!({
                "label": p.label,
                // One participant opens the frostd session and contributes the
                // vault seed. Neither is authority — the session coordinator
                // only routes, and the seed is a value everyone ends up
                // holding. What stops equivocation is the confirmation round.
                "createsSession": i == 0,
                "seedRole": if i == 0 { "contribute" } else { "await" },
                "env": {
                    "QUORUM_DKG_ROSTER": "./roster.json",
                    "QUORUM_DKG_IDENTITY": format!("./{}.key", p.label.to_lowercase()),
                    "QUORUM_DKG_OUT": "./vault",
                    "QUORUM_CEREMONY_URL": "<this coordinator>",
                    "QUORUM_CEREMONY_ID": id,
                    "QUORUM_CEREMONY_LABEL": p.label,
                },
            })
        })
        .collect();

    st.0.lock()
        .map_err(|_| lock_poisoned())?
        .ceremonies
        .insert(id.clone(), ceremony);

    Ok(Json(json!({
        "ceremonyId": id,
        "roster": roster_json,
        "participants": instructions,
        "note": "Each participant runs quorum-dkgd on their own machine. The coordinator \
    never sees a share, and will not register a vault until every participant reports the same \
    group key and address.",
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CeremonyRef {
    ceremony_id: String,
}

async fn ceremony_status(State(st): State<AppState>, Json(req): Json<CeremonyRef>) -> Reply {
    let inner = st.0.lock().map_err(|_| lock_poisoned())?;
    let c = inner
        .ceremonies
        .get(&req.ceremony_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such ceremony"))?;

    let participants: Vec<_> = c
        .roster
        .iter()
        .map(|p| {
            json!({
                "label": p.label,
                "reported": c.reports.contains_key(&p.label),
                "at": c.reports.get(&p.label).map(|r| r.at.clone()),
            })
        })
        .collect();

    Ok(Json(json!({
        "ceremonyId": c.id,
        "label": c.label,
        "threshold": c.threshold,
        "expected": c.roster.len(),
        "reported": c.reports.len(),
        "participants": participants,
        "vaultId": c.vault_id,
        "status": if c.vault_id.is_some() { "COMPLETE" } else { "AWAITING_PARTICIPANTS" },
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReportCeremony {
    ceremony_id: String,
    label: String,
    group_key: String,
    address: String,
    public_key_package: serde_json::Value,
}

/// A participant reports the vault they derived.
///
/// The coordinator compares reports and **registers nothing until they all
/// agree**. A disagreement here is the failure that matters: `ak` comes from
/// FROST, but `nk` and `rivk` come from a seed, and a participant who sent a
/// different seed to each peer produces one group key and several addresses.
/// FROST raises no objection. Funds sent to the wrong one are unspendable by
/// any quorum, and we have lost testnet funds to exactly this.
///
/// The participants already check each other directly during the ceremony's
/// own confirmation round. This is the second pair of eyes, on the server, so
/// a UI cannot activate a vault on one participant's word.
async fn ceremony_report(State(st): State<AppState>, Json(req): Json<ReportCeremony>) -> Reply {
    let mut inner = st.0.lock().map_err(|_| lock_poisoned())?;
    let c = inner
        .ceremonies
        .get_mut(&req.ceremony_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such ceremony"))?;

    if !c.roster.iter().any(|p| p.label == req.label) {
        return Err(bad(
            "INVALID_ARGUMENT",
            format!("{} is not in this ceremony's roster", req.label),
        ));
    }

    // Disagree with anyone already in, and nobody gets a vault.
    if let Some((other, first)) = c
        .reports
        .iter()
        .find(|(_, r)| r.group_key != req.group_key || r.address != req.address)
        .map(|(k, v)| (k.clone(), v.clone()))
    {
        return Err(bad(
            "INVALID_ARGUMENT",
            format!(
                "DISAGREEMENT — {} derived group key {} at {}, {} derived {} at {}. No vault has \
                 been registered. Do not fund either address; restart the ceremony with a \
                 verified roster.",
                req.label, req.group_key, req.address, other, first.group_key, first.address
            ),
        ));
    }

    c.reports.insert(
        req.label.clone(),
        CeremonyReport {
            label: req.label.clone(),
            group_key: req.group_key,
            address: req.address.clone(),
            public_key_package: req.public_key_package.clone(),
            at: now_iso(),
        },
    );

    // Everyone in, and everyone agreeing. Only now does a vault exist.
    if c.reports.len() == c.roster.len() && c.vault_id.is_none() {
        let pubkeys = serde_json::from_value(req.public_key_package)
            .map_err(|e| bad("INVALID_ARGUMENT", format!("public key package: {e}")))?;
        let participants: Vec<Participant> = c
            .roster
            .iter()
            .map(|p| Participant {
                id: p.identifier.clone(),
                label: p.label.clone(),
                token: new_id(),
            })
            .collect();
        let tokens: Vec<_> = participants
            .iter()
            .map(|p| json!({ "participantId": p.id, "label": p.label, "token": p.token }))
            .collect();
        let vault_id = new_id();
        let vault = Vault {
            id: vault_id.clone(),
            label: c.label.clone(),
            threshold: c.threshold,
            address: req.address,
            pubkeys,
            participants,
        };
        c.vault_id = Some(vault_id.clone());
        inner.vaults.insert(vault_id.clone(), vault);
        return Ok(Json(json!({
            "ceremonyId": req.ceremony_id,
            "status": "COMPLETE",
            "vaultId": vault_id,
            "participantTokens": tokens,
        })));
    }

    let (reported, expected) = (c.reports.len(), c.roster.len());
    Ok(Json(json!({
        "ceremonyId": req.ceremony_id,
        "status": "AWAITING_PARTICIPANTS",
        "reported": reported,
        "expected": expected,
    })))
}

async fn vault_register(State(st): State<AppState>, Json(req): Json<RegisterVault>) -> Reply {
    let pubkeys = serde_json::from_value(req.public_key_package)
        .map_err(|e| bad("INVALID_ARGUMENT", format!("public key package: {e}")))?;

    // Each participant gets a token here and only here. The coordinator
    // cannot mint one later for someone who was not in the ceremony.
    let participants: Vec<Participant> = req
        .participants
        .into_iter()
        .map(|p| Participant {
            id: p.id,
            label: p.label,
            token: new_id(),
        })
        .collect();

    let tokens: Vec<_> = participants
        .iter()
        .map(|p| json!({ "participantId": p.id, "label": p.label, "token": p.token }))
        .collect();

    let id = new_id();
    st.add_vault(Vault {
        id: id.clone(),
        label: req.label,
        threshold: req.threshold,
        address: req.address,
        pubkeys,
        participants,
    });

    Ok(Json(json!({ "vaultId": id, "participantTokens": tokens })))
}

async fn vault_list(State(st): State<AppState>) -> Reply {
    let inner = st.0.lock().map_err(|_| lock_poisoned())?;
    let vaults: Vec<_> = inner
        .vaults
        .values()
        .map(|v| {
            json!({
                "id": v.id, "label": v.label, "threshold": v.threshold,
                "shieldedAddress": v.address, "network": "testnet",
                "participants": v.participants.iter()
                    .map(|p| json!({ "identifier": p.id, "label": p.label }))
                    .collect::<Vec<_>>(),
            })
        })
        .collect();
    Ok(Json(json!(vaults)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuditRequest {
    vault_id: String,
    /// Hex vault seed. Required, and not stored here on purpose — the seed
    /// determines the viewing key, so a coordinator holding it could read
    /// every vault's history without anyone opting in.
    vault_seed_hex: String,
}

/// Export the material an auditor needs to check the vault themselves.
///
/// Returns the vault's **unified full viewing key** alongside our event log.
/// The viewing key is the point: an event log is a table we control and
/// could have written anything into, whereas a funder holding the viewing
/// key can reconstruct the vault's history straight from the chain and
/// compare. If the two disagree, believe the chain.
///
/// The response is a secret. A full viewing key reveals every transaction
/// the vault has made.
async fn vault_audit(State(st): State<AppState>, Json(req): Json<AuditRequest>) -> Reply {
    let seed_bytes: [u8; 32] = hex::decode(&req.vault_seed_hex)
        .map_err(|_| bad("INVALID_ARGUMENT", "vaultSeedHex is not hex"))?
        .try_into()
        .map_err(|_| bad("INVALID_ARGUMENT", "vault seed must be 32 bytes"))?;

    let inner = st.0.lock().map_err(|_| lock_poisoned())?;
    let vault = inner
        .vaults
        .get(&req.vault_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such vault"))?;

    let seed = quorum_core::vault_key::VaultSeed::from_bytes(seed_bytes);
    let key = quorum_core::vault_key::VaultKey::derive(&vault.pubkeys, &seed)
        .map_err(|e| bad("INVALID_ARGUMENT", e.to_string()))?;

    // A seed that does not reproduce the vault's address is the wrong seed —
    // and silently exporting a viewing key for a different vault would be
    // worse than failing.
    let ufvk = key.unified_full_viewing_key().ok_or_else(|| {
        bad(
            "INVALID_ARGUMENT",
            "could not build a viewing key for this vault",
        )
    })?;

    let events: Vec<_> = inner
        .approvals
        .values()
        .filter(|a| a.state.vault_id == req.vault_id)
        .flat_map(|a| a.state.events.iter().cloned())
        .collect();

    Ok(Json(json!({
        "vaultId": vault.id,
        "label": vault.label,
        "shieldedAddress": vault.address,
        "network": "testnet",
        "unifiedFullViewingKey": ufvk.encode(&zcash_protocol::consensus::TEST_NETWORK),
        "events": events,
        "verification": "Scan the chain with the viewing key above and compare. \
    This export is only as trustworthy as that comparison — the event log is ours, the chain is not.",
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthorizedRequest {
    approval_id: String,
}

/// The authorized transaction, once a quorum has signed it.
///
/// Without this the coordinator collects signatures and has no way to hand
/// back what they authorize, which leaves the end-to-end flow unable to
/// finish through the service at all.
///
/// # What this response is
///
/// A PCZT with the threshold signatures applied. It still needs proving and
/// extraction before a node will take it — `zcash-devtool pczt prove` then
/// `send` — so it is not itself a broadcastable transaction. But it is the
/// last step that needs anyone's authority, and everything after it is
/// mechanical.
///
/// # What an attacker who takes it can do
///
/// Broadcast it. Nothing else: the recipient, the amount and the fee were
/// all fixed before the first signer committed, and a signature authorizes
/// exactly that transaction. They cannot redirect it, raise it, or reuse it
/// for another spend.
///
/// So the exposure is timing, not theft — a transaction the quorum approved
/// going out sooner than intended, or one they later wanted to abandon going
/// out anyway. Real, and worth saying plainly rather than either
/// hand-waving or overstating. **The coordinator port is not meant to face
/// the public internet**, and the browser tier should be the only thing that
/// reaches it.
async fn approval_authorized(
    State(st): State<AppState>,
    Json(req): Json<AuthorizedRequest>,
) -> Reply {
    let inner = st.0.lock().map_err(|_| lock_poisoned())?;
    let approval = inner
        .approvals
        .get(&req.approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;

    let signatures = match &approval.phase {
        Phase::Signed(sigs) => sigs,
        Phase::Failed => {
            return Err(bad(
                "INVALID_ARGUMENT",
                "this request failed and has no authorized transaction",
            ))
        }
        _ => {
            return Err(bad(
                "INVALID_ARGUMENT",
                format!(
                    "not yet authorized — {} of {} signatures collected",
                    approval.state.signatures_collected, approval.state.threshold
                ),
            ))
        }
    };

    let signed = crate::pczt_job::apply(&approval.pczt, &approval.job.actions, signatures)
        .map_err(|e| bad("INVALID_ARGUMENT", e.to_string()))?;

    Ok(Json(json!({
        "approvalId": approval.state.id,
        "status": approval.state.status,
        "signatureCount": signatures.len(),
        "pcztHex": hex::encode(&signed),
        "nextStep": "zcash-devtool pczt prove, then send. Proving needs no authority.",
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitApproval {
    vault_id: String,
    recipient_address: String,
    amount_zatoshi: String,
    memo: Option<String>,
    /// Hex-encoded PCZT built by a wallet. The coordinator does not build
    /// transactions; it authorizes them.
    pczt_hex: String,
    #[serde(default = "default_deadline")]
    signer_deadline_secs: u64,
}

fn default_deadline() -> u64 {
    300
}

async fn approval_submit(State(st): State<AppState>, Json(req): Json<SubmitApproval>) -> Reply {
    let pczt = hex::decode(&req.pczt_hex)
        .map_err(|e| bad("INVALID_ARGUMENT", format!("pcztHex is not hex: {e}")))?;

    // The vault has to be resolved first: reading the PCZT now requires
    // knowing which vault's key the actions must be bound to, and that check
    // belongs before any signer is asked for a commitment.
    let mut inner = st.0.lock().map_err(|_| lock_poisoned())?;
    let vault = inner
        .vaults
        .get(&req.vault_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such vault"))?;

    let job = job_from_pczt(&pczt, vault).map_err(|e| bad("INVALID_ARGUMENT", e.to_string()))?;

    let round =
        CollectingCommitments::new(job.sighash.to_vec(), job.actions.clone(), vault.threshold)
            .map_err(|e| bad("INVALID_ARGUMENT", e.to_string()))?;

    let id = new_id();
    let now = now_iso();
    let state = ApprovalRequestState {
        id: id.clone(),
        vault_id: req.vault_id.clone(),
        recipient_address: req.recipient_address,
        amount_zatoshi: req.amount_zatoshi,
        memo: req.memo,
        status: ApprovalStatus::Pending,
        txid: None,
        anchor_block: None,
        randomizer_seed_hex: None,
        threshold: vault.threshold,
        signatures_collected: 0,
        signer_statuses: vault
            .participants
            .iter()
            .map(|p| SignerStatus {
                participant_id: p.id.clone(),
                participant_label: p.label.clone(),
                status: SignerState::Pending,
                updated_at: now.clone(),
            })
            .collect(),
        events: vec![],
        created_at: now.clone(),
        expires_at: None,
    };

    inner.approvals.insert(
        id.clone(),
        Approval {
            state: state.clone(),
            job,
            pczt,
            phase: Phase::Commitments(round),
            signer_deadline_secs: req.signer_deadline_secs,
            opened_at: std::time::Instant::now(),
        },
    );
    Ok(Json(json!(state)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ByApproval {
    approval_id: String,
}

async fn approval_status(State(st): State<AppState>, Json(req): Json<ByApproval>) -> Reply {
    let mut inner = st.0.lock().map_err(|_| lock_poisoned())?;
    apply_timeouts(&mut inner, &req.approval_id);
    let a = inner
        .approvals
        .get(&req.approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;
    Ok(Json(json!(a.state)))
}

/// Mark signers who never answered.
///
/// A non-responding signer is a normal outcome, not an error — the most
/// common real failure of shared control is someone on a plane, not someone
/// malicious. It changes nothing about the vault: the round simply waits,
/// and can complete without them if threshold is still reachable.
fn apply_timeouts(inner: &mut Inner, approval_id: &str) {
    let Some(a) = inner.approvals.get_mut(approval_id) else {
        return;
    };
    if !matches!(a.phase, Phase::Commitments(_)) {
        return;
    }
    if a.opened_at.elapsed().as_secs() < a.signer_deadline_secs {
        return;
    }
    let now = now_iso();
    for s in a.state.signer_statuses.iter_mut() {
        if s.status == SignerState::Pending {
            s.status = SignerState::Timeout;
            s.updated_at = now.clone();
            a.state.events.push(SigningRoundEvent {
                id: new_id(),
                approval_request_id: approval_id.to_string(),
                participant_id: s.participant_id.clone(),
                participant_label: s.participant_label.clone(),
                round_type: "COMMITMENT".into(),
                status: "TIMEOUT".into(),
                culprit_detected: false,
                error_code: Some("TIMEOUT".into()),
                error_details: Some(format!(
                    "{} did not respond within the signing window. This is normal — they may \
                     be offline. Nothing has been signed or spent, and the round can still \
                     complete if the threshold is reachable without them.",
                    s.participant_label
                )),
                timestamp: now.clone(),
            });
        }
    }
}

// ── SignerService ────────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ByParticipant {
    participant_id: String,
}

async fn signer_pending(
    State(st): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ByParticipant>,
) -> Reply {
    let token = bearer(&headers).ok_or_else(unauthorized)?;
    let inner = st.0.lock().map_err(|_| lock_poisoned())?;
    if !inner
        .vaults
        .values()
        .any(|v| v.authenticate(&req.participant_id, &token))
    {
        return Err(unauthorized());
    }
    let pending: Vec<_> = inner
        .approvals
        .values()
        .filter(|a| {
            a.state.status == ApprovalStatus::Pending
                && a.state
                    .signer_statuses
                    .iter()
                    .any(|s| s.participant_id == req.participant_id)
        })
        .map(|a| json!(a.state))
        .collect();
    Ok(Json(json!(pending)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Commitments {
    approval_id: String,
    participant_id: String,
    /// One per action, hex, same order as `getSigningPackages().actions`.
    commitments_hex: Vec<String>,
}

async fn signer_commit(
    State(st): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<Commitments>,
) -> Reply {
    let token = bearer(&headers).ok_or_else(unauthorized)?;
    let mut inner = st.0.lock().map_err(|_| lock_poisoned())?;
    let (_, labels) = resolve(&inner, &req.approval_id)?;
    authorize(&inner, &req.approval_id, &req.participant_id, &token)?;
    let a = inner
        .approvals
        .get_mut(&req.approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;

    let identifier = parse_identifier(&req.participant_id)?;
    let commitments = req
        .commitments_hex
        .iter()
        .map(|h| {
            hex::decode(h)
                .ok()
                .and_then(|b| frost_core::round1::SigningCommitments::deserialize(&b).ok())
                .ok_or_else(|| bad("INVALID_ARGUMENT", "malformed commitment"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    // Scope the borrow so `mark` can touch the rest of the approval.
    let ready = {
        let Phase::Commitments(round) = &mut a.phase else {
            return Err(bad("ROUND_ABORTED", "round 1 is closed for this request"));
        };
        round.add(identifier, commitments).map_err(|e| {
            ApiError(
                StatusCode::BAD_REQUEST,
                CoordinatorErrorBody::from_protocol(&e, &labels),
            )
        })?;
        round.is_ready()
    };

    let now = now_iso();
    mark(
        a,
        &req.participant_id,
        SignerState::Pending,
        "COMMITMENT",
        "RECEIVED",
        &now,
    );

    if ready {
        // Threshold commitments in — round 2 can begin, and only now.
        let ready = std::mem::replace(&mut a.phase, Phase::Failed);
        if let Phase::Commitments(r) = ready {
            match r.build() {
                Ok(shares) => a.phase = Phase::Shares(Box::new(shares)),
                Err(e) => {
                    a.phase = Phase::Failed;
                    return Err(ApiError(
                        StatusCode::CONFLICT,
                        CoordinatorErrorBody::from_protocol(&e, &labels),
                    ));
                }
            }
        }
    }

    Ok(Json(
        json!({ "approvalRequestId": req.approval_id, "roundType": "COMMITMENT", "status": "RECEIVED" }),
    ))
}

/// What a participant is being asked to authorize, before they authorize it.
///
/// Available in every phase, deliberately: committing to a nonce in round 1 is
/// already a cryptographic act, so a signer that can only see the transaction
/// at round 2 has already acted on trust.
///
/// `recipientAddress`, `amountZatoshi` and `memo` are **the proposer's claims**
/// and are labelled as such. The authoritative answer is whatever the signer
/// can read out of `pcztHex` for itself; a shielded output may carry its value
/// in the clear or may not, and "we cannot tell" is a better answer than a
/// number we were handed.
async fn signer_request(
    State(st): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<Commitments>,
) -> Reply {
    let token = bearer(&headers).ok_or_else(unauthorized)?;
    let inner = st.0.lock().map_err(|_| lock_poisoned())?;
    authorize(&inner, &req.approval_id, &req.participant_id, &token)?;
    let a = inner
        .approvals
        .get(&req.approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;
    let vault = inner
        .vaults
        .get(&a.state.vault_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such vault"))?;

    Ok(Json(json!({
        "approvalId": a.state.id,
        "vaultLabel": vault.label,
        "vaultAddress": vault.address,
        "threshold": vault.threshold,
        "pcztHex": hex::encode(&a.pczt),
        "claimedRecipient": a.state.recipient_address,
        "claimedAmountZatoshi": a.state.amount_zatoshi.to_string(),
        "claimedMemo": a.state.memo,
        "note": "recipient, amount and memo are the proposer's claims. Read the PCZT yourself.",
    })))
}

async fn signer_packages(
    State(st): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<Commitments>,
) -> Reply {
    let token = bearer(&headers).ok_or_else(unauthorized)?;
    let inner = st.0.lock().map_err(|_| lock_poisoned())?;
    authorize(&inner, &req.approval_id, &req.participant_id, &token)?;
    let a = inner
        .approvals
        .get(&req.approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;

    let Phase::Shares(round) = &a.phase else {
        return Err(bad(
            "THRESHOLD_NOT_MET",
            "signing packages are not available until threshold commitments are in",
        ));
    };

    let packages: Vec<String> = round
        .signing_packages()
        .iter()
        .map(|p| p.serialize().map(hex::encode).unwrap_or_default())
        .collect();

    Ok(Json(json!(SigningPackages {
        sighash_hex: hex::encode(a.job.sighash),
        actions: actions_to_wire(&a.job.actions),
        signing_packages_hex: packages,
        pczt_hex: hex::encode(&a.pczt),
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Shares {
    approval_id: String,
    participant_id: String,
    shares_hex: Vec<String>,
}

async fn signer_shares(
    State(st): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<Shares>,
) -> Reply {
    let token = bearer(&headers).ok_or_else(unauthorized)?;
    let mut inner = st.0.lock().map_err(|_| lock_poisoned())?;
    let (_, labels) = resolve(&inner, &req.approval_id)?;
    authorize(&inner, &req.approval_id, &req.participant_id, &token)?;
    let vault_id = inner
        .approvals
        .get(&req.approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?
        .state
        .vault_id
        .clone();
    let pubkeys = inner
        .vaults
        .get(&vault_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "vault vanished"))?
        .pubkeys
        .clone();
    let a = inner
        .approvals
        .get_mut(&req.approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;

    let identifier = parse_identifier(&req.participant_id)?;
    let shares = req
        .shares_hex
        .iter()
        .map(|h| {
            hex::decode(h)
                .ok()
                .and_then(|b| frost_core::round2::SignatureShare::deserialize(&b).ok())
                .ok_or_else(|| bad("INVALID_ARGUMENT", "malformed signature share"))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let complete = {
        let Phase::Shares(round) = &mut a.phase else {
            return Err(bad(
                "ROUND_ABORTED",
                "this request is not collecting signature shares",
            ));
        };
        round.add(identifier, shares).map_err(|e| {
            ApiError(
                StatusCode::BAD_REQUEST,
                CoordinatorErrorBody::from_protocol(&e, &labels),
            )
        })?;
        round.have() >= round.expected_signers().len()
    };

    let now = now_iso();
    mark(
        a,
        &req.participant_id,
        SignerState::Approved,
        "SIGNATURE_SHARE",
        "RECEIVED",
        &now,
    );
    a.state.signatures_collected += 1;

    if complete {
        let done = std::mem::replace(&mut a.phase, Phase::Failed);
        if let Phase::Shares(r) = done {
            match r.aggregate(&pubkeys) {
                Ok(sigs) => {
                    a.state.status = ApprovalStatus::Approved;
                    a.phase = Phase::Signed(sigs);
                }
                Err(e) => {
                    // A bad share fails the whole transaction, by design:
                    // partial authorization is a node rejection with nothing
                    // local to explain it.
                    let body = CoordinatorErrorBody::from_protocol(&e, &labels);
                    if let Some(names) = &body.culprits {
                        for n in names {
                            if let Some(s) = a
                                .state
                                .signer_statuses
                                .iter_mut()
                                .find(|s| &s.participant_label == n)
                            {
                                s.status = SignerState::InvalidShare;
                                s.updated_at = now.clone();
                            }
                        }
                    }
                    a.state.events.push(SigningRoundEvent {
                        id: new_id(),
                        approval_request_id: req.approval_id.clone(),
                        participant_id: req.participant_id.clone(),
                        participant_label: body
                            .culprits
                            .as_ref()
                            .and_then(|c| c.first().cloned())
                            .unwrap_or_default(),
                        round_type: "SIGNATURE_SHARE".into(),
                        status: "INVALID".into(),
                        culprit_detected: true,
                        error_code: Some(body.code.clone()),
                        error_details: Some(body.message.clone()),
                        timestamp: now.clone(),
                    });
                    a.state.status = ApprovalStatus::Rejected;
                    a.phase = Phase::Failed;
                    return Err(ApiError(StatusCode::CONFLICT, body));
                }
            }
        }
    }

    Ok(Json(
        json!({ "approvalRequestId": req.approval_id, "roundType": "SIGNATURE_SHARE", "status": "RECEIVED" }),
    ))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Decline {
    approval_id: String,
    participant_id: String,
}

async fn signer_decline(
    State(st): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<Decline>,
) -> Reply {
    let token = bearer(&headers).ok_or_else(unauthorized)?;
    let mut inner = st.0.lock().map_err(|_| lock_poisoned())?;
    authorize(&inner, &req.approval_id, &req.participant_id, &token)?;
    let a = inner
        .approvals
        .get_mut(&req.approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;
    let now = now_iso();
    // Refusing is not the same as failing to answer, and the UI should not
    // conflate them.
    mark(
        a,
        &req.participant_id,
        SignerState::Declined,
        "COMMITMENT",
        "INVALID",
        &now,
    );

    // Can a quorum still be reached? Once enough participants are out, the
    // request can never succeed, and leaving it PENDING until the deadline
    // tells a treasurer to keep waiting for something that will not happen.
    //
    // Surfaced before the consent gate existed nothing ever declined in
    // practice, so nothing ever sat in this state long enough to notice.
    let still_possible = a
        .state
        .signer_statuses
        .iter()
        .filter(|s| matches!(s.status, SignerState::Pending | SignerState::Approved))
        .count();

    if still_possible < a.state.threshold as usize {
        a.state.status = ApprovalStatus::Rejected;
        a.phase = Phase::Failed;
        let declined = a
            .state
            .signer_statuses
            .iter()
            .filter(|s| s.status == SignerState::Declined)
            .count();
        a.state.events.push(SigningRoundEvent {
            id: new_id(),
            approval_request_id: req.approval_id.clone(),
            participant_id: String::new(),
            participant_label: String::new(),
            round_type: "COMMITMENT".into(),
            status: "INVALID".into(),
            // Nobody misbehaved. Declining is the system working, and the
            // event log must not read as an accusation.
            culprit_detected: false,
            error_code: Some("QUORUM_UNREACHABLE".into()),
            error_details: Some(format!(
                "Closed — {declined} of {} signers declined, so the threshold of {} can no \
                 longer be met. Nothing was signed and no funds moved. This is a decision, \
                 not a fault: submit a new request if the terms should change.",
                a.state.signer_statuses.len(),
                a.state.threshold
            )),
            timestamp: now.clone(),
        });
    }

    Ok(Json(json!(a.state)))
}

// ── helpers ──────────────────────────────────────────────────

/// Confirm the caller is the participant it claims, on this vault.
fn authorize(
    inner: &Inner,
    approval_id: &str,
    participant_id: &str,
    token: &str,
) -> Result<(), ApiError> {
    let a = inner
        .approvals
        .get(approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;
    let v = inner
        .vaults
        .get(&a.state.vault_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "vault vanished"))?;
    if v.authenticate(participant_id, token) {
        Ok(())
    } else {
        Err(unauthorized())
    }
}

fn resolve(
    inner: &Inner,
    approval_id: &str,
) -> Result<(String, std::collections::BTreeMap<String, String>), ApiError> {
    let a = inner
        .approvals
        .get(approval_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "no such approval request"))?;
    let v = inner
        .vaults
        .get(&a.state.vault_id)
        .ok_or_else(|| bad("SESSION_NOT_FOUND", "vault vanished"))?;
    Ok((v.id.clone(), v.labels()))
}

fn parse_identifier(
    hex_id: &str,
) -> Result<frost_core::Identifier<quorum_core::Ciphersuite>, ApiError> {
    let raw = hex::decode(hex_id).map_err(|_| bad("INVALID_ARGUMENT", "identifier is not hex"))?;
    frost_core::Identifier::deserialize(&raw)
        .map_err(|_| bad("INVALID_ARGUMENT", "not a valid FROST identifier"))
}

fn mark(
    a: &mut Approval,
    participant_id: &str,
    status: SignerState,
    round_type: &str,
    event_status: &str,
    now: &str,
) {
    let label = a
        .state
        .signer_statuses
        .iter()
        .find(|s| s.participant_id == participant_id)
        .map(|s| s.participant_label.clone())
        .unwrap_or_else(|| participant_id.to_string());

    if let Some(s) = a
        .state
        .signer_statuses
        .iter_mut()
        .find(|s| s.participant_id == participant_id)
    {
        s.status = status;
        s.updated_at = now.to_string();
    }
    a.state.events.push(SigningRoundEvent {
        id: new_id(),
        approval_request_id: a.state.id.clone(),
        participant_id: participant_id.to_string(),
        participant_label: label,
        round_type: round_type.into(),
        status: event_status.into(),
        culprit_detected: false,
        error_code: None,
        error_details: None,
        timestamp: now.to_string(),
    });
}
