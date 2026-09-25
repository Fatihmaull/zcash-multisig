//! HTTP client for `frostd`.
//!
//! Nine endpoints, all `POST` with JSON. Byte fields travel as lowercase hex,
//! matching what `serdect`'s hex-or-bin serialisation produces for JSON — we
//! spell it out here rather than depending on `serdect` directly, because the
//! version `frost-client` uses and the one `frost-core 3.0.0` pulls differ.
//!
//! # Session shape
//!
//! One participant is the coordinator: they call `create_new_session` with
//! everyone's public keys and receive a session id to distribute. Everyone
//! else joins by id. From then on `send` and `receive` move opaque bytes —
//! which is why our FROST v3 types pass through a relay built for v2.
//!
//! # What is encrypted and what is not
//!
//! **This module does no encryption.** Payloads must already be sealed by
//! [`super::cipher::Cipher`] before they reach `send`. The TLS here protects
//! traffic to the server; it does nothing about the server itself, which is
//! precisely what the Noise layer is for.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::identity::PeerPublicKey;

/// Identifies a ceremony or signing session on the relay.
pub type SessionId = Uuid;

#[derive(Debug, thiserror::Error)]
pub enum FrostdError {
    #[error("transport failure talking to frostd: {0}")]
    Http(#[from] reqwest::Error),

    /// The server rejected the call. `code` is frostd's own taxonomy:
    /// 1 invalid argument, 2 unauthorized, 3 session not found,
    /// 4 not coordinator, 5 not in session, 255 unknown.
    #[error("frostd rejected the request ({code}): {message}")]
    Rejected { code: usize, message: String },

    #[error("not logged in; call login() first")]
    NotAuthenticated,

    #[error("malformed hex from frostd: {0}")]
    BadHex(#[from] hex::FromHexError),
}

// ── Wire types ───────────────────────────────────────────────
// Field names and shapes must match frostd exactly.

#[derive(Deserialize)]
struct ChallengeOutput {
    challenge: Uuid,
}

#[derive(Serialize)]
struct LoginArgs<'a> {
    challenge: Uuid,
    pubkey: &'a PeerPublicKey,
    /// Hex, as frostd expects for byte fields in JSON.
    signature: String,
}

#[derive(Deserialize)]
struct LoginOutput {
    access_token: Uuid,
}

#[derive(Serialize)]
struct CreateNewSessionArgs<'a> {
    pubkeys: &'a [PeerPublicKey],
    message_count: u8,
}

#[derive(Deserialize)]
struct CreateNewSessionOutput {
    session_id: Uuid,
}

#[derive(Serialize)]
struct SessionArgs {
    session_id: SessionId,
}

#[derive(Deserialize)]
pub struct SessionInfo {
    pub message_count: u8,
    pub pubkeys: Vec<PeerPublicKey>,
    pub coordinator_pubkey: PeerPublicKey,
}

#[derive(Serialize)]
struct SendArgs<'a> {
    session_id: SessionId,
    recipients: &'a [PeerPublicKey],
    /// Hex of the **already-encrypted** payload.
    msg: String,
}

#[derive(Serialize)]
struct ReceiveArgs {
    session_id: SessionId,
    as_coordinator: bool,
}

#[derive(Deserialize)]
struct RawMsg {
    sender: PeerPublicKey,
    msg: String,
}

#[derive(Deserialize)]
struct ReceiveOutput {
    msgs: Vec<RawMsg>,
}

#[derive(Deserialize)]
struct ErrorBody {
    code: usize,
    msg: String,
}

/// One message off the relay, still encrypted.
#[derive(Debug, Clone)]
pub struct RelayedMessage {
    pub sender: PeerPublicKey,
    /// Ciphertext. Feed to [`super::cipher::Cipher::decrypt`].
    pub ciphertext: Vec<u8>,
}

/// A connection to `frostd`.
pub struct FrostdClient {
    http: reqwest::Client,
    base_url: String,
    access_token: Option<Uuid>,
}

impl FrostdClient {
    /// `base_url` like `https://frostd.example:2744`, no trailing slash.
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: base_url.into().trim_end_matches('/').to_string(),
            access_token: None,
        }
    }

    pub fn is_authenticated(&self) -> bool {
        self.access_token.is_some()
    }

    async fn call<Req: Serialize, Res: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        body: &Req,
        authenticated: bool,
    ) -> Result<Res, FrostdError> {
        let mut req = self
            .http
            .post(format!("{}/{}", self.base_url, path))
            .json(body);

        if authenticated {
            let token = self.access_token.ok_or(FrostdError::NotAuthenticated)?;
            req = req.bearer_auth(token);
        }

        let response = req.send().await?;
        if response.status().is_success() {
            return Ok(response.json().await?);
        }

        // frostd returns a structured error body; fall back to the status
        // line if it does not, so a proxy or a crash still yields something
        // actionable rather than a parse failure.
        let status = response.status();
        match response.json::<ErrorBody>().await {
            Ok(e) => Err(FrostdError::Rejected {
                code: e.code,
                message: e.msg,
            }),
            Err(_) => Err(FrostdError::Rejected {
                code: status.as_u16() as usize,
                message: format!("HTTP {status}"),
            }),
        }
    }

    /// Like [`Self::call`] but for endpoints that answer with an empty body.
    ///
    /// `send`, `logout` and `close_session` return no content on success.
    /// Parsing those as JSON fails with "EOF while parsing a value" — a
    /// confusing way to learn that the call actually worked.
    async fn call_void<Req: Serialize>(
        &self,
        path: &str,
        body: &Req,
        authenticated: bool,
    ) -> Result<(), FrostdError> {
        let mut req = self
            .http
            .post(format!("{}/{}", self.base_url, path))
            .json(body);

        if authenticated {
            let token = self.access_token.ok_or(FrostdError::NotAuthenticated)?;
            req = req.bearer_auth(token);
        }

        let response = req.send().await?;
        if response.status().is_success() {
            return Ok(());
        }

        let status = response.status();
        match response.json::<ErrorBody>().await {
            Ok(e) => Err(FrostdError::Rejected {
                code: e.code,
                message: e.msg,
            }),
            Err(_) => Err(FrostdError::Rejected {
                code: status.as_u16() as usize,
                message: format!("HTTP {status}"),
            }),
        }
    }

    /// Authenticate: fetch a challenge, sign it, exchange it for a token.
    ///
    /// The signature proves possession of the private key matching `pubkey`,
    /// which is the same key the Noise layer uses.
    pub async fn login<R: rand_core::RngCore + rand_core::CryptoRng>(
        &mut self,
        identity: &super::identity::Identity,
        rng: R,
    ) -> Result<(), FrostdError> {
        let challenge: ChallengeOutput = self.call("challenge", &(), false).await?;
        let signature = identity
            .private_key()
            .sign_challenge(challenge.challenge.as_bytes(), rng);

        let out: LoginOutput = self
            .call(
                "login",
                &LoginArgs {
                    challenge: challenge.challenge,
                    pubkey: identity.public_key(),
                    signature: hex::encode(signature),
                },
                false,
            )
            .await?;

        self.access_token = Some(out.access_token);
        Ok(())
    }

    pub async fn logout(&mut self) -> Result<(), FrostdError> {
        self.call_void("logout", &(), true).await?;
        self.access_token = None;
        Ok(())
    }

    /// Open a session. The caller becomes its coordinator.
    ///
    /// **`participants` must include the caller when the caller is itself a
    /// participant.** frostd treats the session coordinator as a separate
    /// role that "doesn't have to be a participant", so it does not add them
    /// to `session.pubkeys`. Two consequences, neither of which announces
    /// itself:
    ///
    /// - `send` rejects any recipient not in `pubkeys` with `NotInSession`,
    ///   so peers cannot address the coordinator.
    /// - the coordinator's `receive(.., false)` reads an empty participant
    ///   queue forever, and the round simply times out.
    ///
    /// In Quorum the coordinator role is only about who opened the session.
    /// It carries no authority over the vault: DKG has every participant
    /// send to every other, and a relay that withholds messages can stall a
    /// ceremony but never complete one on its own.
    ///
    /// `message_count` is informational — frostd requires it to be non-zero
    /// and otherwise only reports it back through `get_session_info`.
    pub async fn create_session(
        &self,
        participants: &[PeerPublicKey],
        message_count: u8,
    ) -> Result<SessionId, FrostdError> {
        let out: CreateNewSessionOutput = self
            .call(
                "create_new_session",
                &CreateNewSessionArgs {
                    pubkeys: participants,
                    message_count,
                },
                true,
            )
            .await?;
        Ok(out.session_id)
    }

    /// Sessions this participant belongs to. How a joiner finds the one they
    /// were invited to without the coordinator sending an id out of band.
    pub async fn list_sessions(&self) -> Result<Vec<SessionId>, FrostdError> {
        #[derive(Deserialize)]
        struct Out {
            session_ids: Vec<Uuid>,
        }
        let out: Out = self.call("list_sessions", &(), true).await?;
        Ok(out.session_ids)
    }

    pub async fn session_info(&self, session_id: SessionId) -> Result<SessionInfo, FrostdError> {
        self.call("get_session_info", &SessionArgs { session_id }, true)
            .await
    }

    /// Relay an **already-encrypted** payload.
    ///
    /// An empty `recipients` means the coordinator; otherwise it addresses
    /// those participants. Passing plaintext here would hand the relay
    /// exactly what the Noise layer exists to withhold.
    pub async fn send(
        &self,
        session_id: SessionId,
        recipients: &[PeerPublicKey],
        ciphertext: &[u8],
    ) -> Result<(), FrostdError> {
        self.call_void(
            "send",
            &SendArgs {
                session_id,
                recipients,
                msg: hex::encode(ciphertext),
            },
            true,
        )
        .await
    }

    /// Collect messages waiting for us. Still encrypted.
    ///
    /// Returns immediately, empty if nothing has arrived — the relay does not
    /// block, so callers poll.
    pub async fn receive(
        &self,
        session_id: SessionId,
        as_coordinator: bool,
    ) -> Result<Vec<RelayedMessage>, FrostdError> {
        let out: ReceiveOutput = self
            .call(
                "receive",
                &ReceiveArgs {
                    session_id,
                    as_coordinator,
                },
                true,
            )
            .await?;

        out.msgs
            .into_iter()
            .map(|m| {
                Ok(RelayedMessage {
                    sender: m.sender,
                    ciphertext: hex::decode(&m.msg)?,
                })
            })
            .collect()
    }

    pub async fn close_session(&self, session_id: SessionId) -> Result<(), FrostdError> {
        self.call_void("close_session", &SessionArgs { session_id }, true)
            .await
    }
}
