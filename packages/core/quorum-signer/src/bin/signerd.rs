//! One participant, one process, one share.
//!
//! ```sh
//! QUORUM_SIGNER_SHARE=./secrets/vault/share-1.bin \
//! QUORUM_SIGNER_PASSPHRASE=... \
//! QUORUM_SIGNER_ID=<hex identifier> \
//! QUORUM_SIGNER_TOKEN=<from vault registration> \
//! cargo run -p quorum-signer --bin quorum-signerd
//! ```
//!
//! This is what makes the non-custodial claim demonstrable rather than
//! asserted. Run three of these on three machines and no single process
//! ever holds more than one share — which is the difference between a
//! threshold vault and a wallet with extra steps.
//!
//! The share is unsealed into this process's memory and never sent
//! anywhere. What goes over the wire is commitments and signature shares,
//! neither of which is secret. Constraint C5: signing needs an
//! *authenticated* channel, not a confidential one — hence the bearer
//! token, and hence no Noise layer here. DKG is the opposite and uses
//! `frostd`.
//!
//! # `--misbehave`
//!
//! Set `QUORUM_SIGNER_MISBEHAVE=1` and this signer signs under a randomizer
//! that is not the one the transaction specifies. The share is structurally
//! valid — it deserialises, it verifies against *some* key — and fails
//! aggregation, which is how a compromised device actually looks.
//!
//! The obvious approach, signing from a second session, does not work:
//! `round2::sign` rejects it locally with "the participant's commitment is
//! incorrect", because FROST will not let a signer contradict a commitment
//! it already made. Worth knowing — the protocol refuses to help you
//! misbehave in the easy way.

use std::time::Duration;

use frost_core::keys::KeyPackage;
use quorum_core::Ciphersuite;
use quorum_signer::{store::open, SigningSession};
use serde_json::{json, Value};

struct Config {
    coordinator: String,
    share_path: String,
    passphrase: String,
    participant_id: String,
    token: String,
    label: String,
    misbehave: bool,
    poll: Duration,
}

fn config() -> Config {
    let need = |k: &str| {
        std::env::var(k).unwrap_or_else(|_| {
            eprintln!("missing required environment variable {k}");
            std::process::exit(2);
        })
    };
    Config {
        coordinator: std::env::var("QUORUM_COORDINATOR_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:2745".into()),
        share_path: need("QUORUM_SIGNER_SHARE"),
        passphrase: need("QUORUM_SIGNER_PASSPHRASE"),
        participant_id: need("QUORUM_SIGNER_ID"),
        token: need("QUORUM_SIGNER_TOKEN"),
        label: std::env::var("QUORUM_SIGNER_LABEL").unwrap_or_else(|_| "signer".into()),
        misbehave: std::env::var("QUORUM_SIGNER_MISBEHAVE").is_ok(),
        poll: Duration::from_millis(
            std::env::var("QUORUM_SIGNER_POLL_MS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(1500),
        ),
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let cfg = config();
    let sealed = std::fs::read(&cfg.share_path).unwrap_or_else(|e| {
        eprintln!("cannot read {}: {e}", cfg.share_path);
        std::process::exit(2);
    });
    let key_package: KeyPackage<Ciphersuite> = open(&sealed, &cfg.passphrase).unwrap_or_else(|e| {
        eprintln!("cannot unseal the share: {e}");
        std::process::exit(2);
    });

    tracing::info!(label = %cfg.label, "signer ready");
    if cfg.misbehave {
        tracing::warn!("MISBEHAVE MODE — this signer will submit shares that do not verify");
    }

    let http = reqwest::Client::new();
    let mut handled: Vec<String> = Vec::new();

    loop {
        match pending(&http, &cfg).await {
            Ok(requests) => {
                for id in requests {
                    if handled.contains(&id) {
                        continue;
                    }
                    match participate(&http, &cfg, &key_package, &id).await {
                        Ok(()) => tracing::info!(request = %id, "signed"),
                        Err(e) => tracing::warn!(request = %id, "round failed: {e}"),
                    }
                    handled.push(id);
                }
            }
            Err(e) => tracing::warn!("cannot reach the coordinator: {e}"),
        }
        tokio::time::sleep(cfg.poll).await;
    }
}

async fn post(
    http: &reqwest::Client,
    cfg: &Config,
    path: &str,
    body: Value,
) -> Result<Value, String> {
    let res = http
        .post(format!("{}{path}", cfg.coordinator))
        .bearer_auth(&cfg.token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let value: Value = res.json().await.unwrap_or(Value::Null);
    if status.is_success() {
        Ok(value)
    } else {
        // The coordinator's errors are structured on purpose; keep the
        // message rather than reducing it to a status code.
        Err(value["message"]
            .as_str()
            .unwrap_or("request rejected")
            .to_string())
    }
}

async fn pending(http: &reqwest::Client, cfg: &Config) -> Result<Vec<String>, String> {
    let v = post(
        http,
        cfg,
        "/signer/pending",
        json!({ "participantId": cfg.participant_id }),
    )
    .await?;
    Ok(v.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|r| r["id"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default())
}

/// Both FROST rounds for one approval request.
async fn participate(
    http: &reqwest::Client,
    cfg: &Config,
    key_package: &KeyPackage<Ciphersuite>,
    approval_id: &str,
) -> Result<(), String> {
    let mut rng = rand::thread_rng();

    // How many actions? Ask rather than assume — a transaction with two
    // shielded inputs needs two complete rounds, and guessing one would
    // sign the first input and silently drop the rest.
    let probe = post(
        http,
        cfg,
        "/signer/packages",
        json!({ "approvalId": approval_id, "participantId": cfg.participant_id, "commitmentsHex": [] }),
    )
    .await;
    let action_count = probe
        .ok()
        .and_then(|v| v["actions"].as_array().map(|a| a.len()))
        .unwrap_or(1);

    // ── Round 1 ──
    let session =
        SigningSession::begin(key_package, action_count, &mut rng).map_err(|e| e.to_string())?;
    let commitments: Vec<String> = session
        .commitments()
        .iter()
        .map(|c| c.serialize().map(hex::encode).unwrap_or_default())
        .collect();

    post(
        http,
        cfg,
        "/signer/commit",
        json!({
            "approvalId": approval_id,
            "participantId": cfg.participant_id,
            "commitmentsHex": commitments,
        }),
    )
    .await?;
    tracing::info!(request = %approval_id, "round 1 submitted");

    // ── Wait for threshold, then round 2 ──
    let packages = wait_for_packages(http, cfg, approval_id).await?;
    let signing_packages: Vec<frost_core::SigningPackage<Ciphersuite>> = packages
        ["signingPackagesHex"]
        .as_array()
        .ok_or("no signing packages")?
        .iter()
        .map(|h| {
            let raw = hex::decode(h.as_str().unwrap_or_default()).map_err(|e| e.to_string())?;
            frost_core::SigningPackage::deserialize(&raw).map_err(|e| e.to_string())
        })
        .collect::<Result<_, String>>()?;

    let randomizers: Vec<[u8; 32]> = packages["actions"]
        .as_array()
        .ok_or("no actions")?
        .iter()
        .map(|a| {
            let raw = hex::decode(a["alphaHex"].as_str().unwrap_or_default())
                .map_err(|e| e.to_string())?;
            raw.try_into()
                .map_err(|_| "alpha is not 32 bytes".to_string())
        })
        .collect::<Result<_, String>>()?;

    let randomizers = if cfg.misbehave {
        // Flip one bit of each randomizer. The signer's own commitment is
        // still honoured, so `round2::sign` is happy — but the share is
        // bound to the wrong randomized key and aggregation will reject it,
        // naming this signer. That is what a compromised device produces.
        tracing::warn!(request = %approval_id, "signing under the wrong randomizer");
        randomizers
            .into_iter()
            .map(|mut a| {
                a[0] ^= 0x01;
                a
            })
            .collect()
    } else {
        randomizers
    };

    // `sign` consumes the session — the round-1 nonces cannot be reused,
    // and the compiler is what guarantees it.
    let shares = session
        .sign(key_package, &signing_packages, &randomizers)
        .map_err(|e| e.to_string())?;

    let hexes: Vec<String> = shares.iter().map(|s| hex::encode(s.serialize())).collect();
    post(
        http,
        cfg,
        "/signer/shares",
        json!({
            "approvalId": approval_id,
            "participantId": cfg.participant_id,
            "sharesHex": hexes,
        }),
    )
    .await?;
    Ok(())
}

/// Round 2 cannot start until the coordinator holds threshold commitments,
/// so a signer that arrives first genuinely has to wait for the others.
async fn wait_for_packages(
    http: &reqwest::Client,
    cfg: &Config,
    approval_id: &str,
) -> Result<Value, String> {
    for _ in 0..120 {
        match post(
            http,
            cfg,
            "/signer/packages",
            json!({
                "approvalId": approval_id,
                "participantId": cfg.participant_id,
                "commitmentsHex": [],
            }),
        )
        .await
        {
            Ok(v) if v["signingPackagesHex"].is_array() => return Ok(v),
            _ => tokio::time::sleep(Duration::from_millis(500)).await,
        }
    }
    Err("threshold commitments never arrived".into())
}
