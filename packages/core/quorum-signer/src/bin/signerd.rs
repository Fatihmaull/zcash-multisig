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
use orchard::keys::SpendValidatingKey;
use quorum_core::Ciphersuite;
use quorum_signer::{store::open, SigningSession};
use serde_json::{json, Value};

struct Config {
    coordinator: String,
    share_path: String,
    /// Sign without asking a human. **Scripted demos and tests only.**
    ///
    /// A daemon that signs whatever it is handed is not shared custody; it is
    /// three machines saying yes. The gate is the product. This flag exists
    /// because a recorded demo cannot pause for a keystroke, and it announces
    /// itself loudly when set.
    auto_approve: bool,
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
        auto_approve: std::env::var("QUORUM_SIGNER_AUTO_APPROVE").as_deref() == Ok("1"),
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
    if cfg.auto_approve {
        tracing::warn!(
            "AUTO-APPROVE — this signer will not ask before signing. Scripted runs only."
        );
    }
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

    // ── Read the transaction ourselves, before anything cryptographic ──
    //
    // Round 1 commits a nonce, which is already an act. So the transaction
    // has to be examined first, and examined from the transaction — not from
    // the coordinator's description of it.
    let request = post(
        http,
        cfg,
        "/signer/request",
        json!({ "approvalId": approval_id, "participantId": cfg.participant_id, "commitmentsHex": [] }),
    )
    .await?;
    let pczt = hex::decode(request["pcztHex"].as_str().unwrap_or_default())
        .map_err(|e| format!("the coordinator sent an unreadable transaction: {e}"))?;

    let ak = vault_ak(key_package)?;
    let summary = quorum_core::transaction::summarize(&pczt, &ak).map_err(|e| e.to_string())?;

    // How many actions? Counted from the transaction. Asking the coordinator
    // would mean signing as many rounds as it asked for.
    let action_count = summary.spends.len();

    describe(approval_id, &request, &summary);
    if !cfg.auto_approve && !consent()? {
        post(
            http,
            cfg,
            "/signer/decline",
            json!({ "approvalId": approval_id, "participantId": cfg.participant_id }),
        )
        .await?;
        return Err("declined by the participant".into());
    }

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

    // ── The check that closes the hole ──
    //
    // The coordinator has now told us a sighash and a set of randomizers. We
    // derived both from the transaction ourselves; if they disagree, someone
    // is asking us to authorize something other than what we were shown.
    let offered_sighash: [u8; 32] =
        hex::decode(packages["sighashHex"].as_str().unwrap_or_default())
            .map_err(|e| e.to_string())?
            .try_into()
            .map_err(|_| "the sighash offered is not 32 bytes".to_string())?;
    quorum_core::transaction::verify_offer(&pczt, &ak, &offered_sighash, &randomizers)
        .map_err(|e| e.to_string())?;

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

/// This vault's spend validating key, from our own share.
///
/// Read from the key package rather than from anything the coordinator sent.
/// It is the anchor of every other check: it says which vault we are a member
/// of, and a transaction that does not spend from it is not ours to sign.
fn vault_ak(key_package: &KeyPackage<Ciphersuite>) -> Result<SpendValidatingKey, String> {
    let bytes = key_package
        .verifying_key()
        .serialize()
        .map_err(|e| format!("unusable group key: {e}"))?;
    SpendValidatingKey::from_bytes(&bytes)
        .ok_or_else(|| "this vault's group key is not a valid Orchard ak".to_string())
}

/// Show the participant what they are being asked to authorize.
///
/// Two columns, because they are two different kinds of fact. What the
/// transaction says is checked. What the proposer claims is not, and is
/// labelled so a participant can see when the two do not agree.
fn describe(approval_id: &str, request: &Value, summary: &quorum_core::transaction::Summary) {
    let s = |k: &str| request[k].as_str().unwrap_or("—").to_string();
    println!();
    println!("  ────────────────────────────────────────────────────────────");
    println!("  APPROVAL REQUEST  {approval_id}");
    println!("  vault    {}", s("vaultLabel"));
    println!("  sighash  {}", hex::encode(summary.sighash));
    println!();
    println!("  FROM THE TRANSACTION — verified against your own share");
    for spend in &summary.spends {
        println!(
            "    spend   {:?} action {}  — spends from this vault",
            spend.pool, spend.index
        );
    }
    let mut stated = 0usize;
    for out in &summary.outputs {
        match out.value {
            Some(v) => {
                stated += 1;
                println!(
                    "    output  {:?} action {}  {}.{:08} TAZ{}",
                    out.pool,
                    out.index,
                    v / 100_000_000,
                    v % 100_000_000,
                    if out.recipient_known {
                        "  to a named address"
                    } else {
                        "  recipient not stated"
                    }
                );
            }
            None => println!(
                "    output  {:?} action {}  value not stated in the transaction",
                out.pool, out.index
            ),
        }
    }
    if stated == 0 {
        println!("    (this transaction states no output values — see the caution below)");
    }
    println!();
    println!("  CLAIMED BY THE PROPOSER — not verified, and not verifiable here");
    println!("    to       {}", s("claimedRecipient"));
    let claimed: u64 = request["claimedAmountZatoshi"]
        .as_str()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    println!(
        "    amount   {}.{:08} TAZ",
        claimed / 100_000_000,
        claimed % 100_000_000
    );
    if request["claimedMemo"].is_string() {
        println!("    memo     {}", s("claimedMemo"));
    }
    println!();
    println!("  What is checked: this transaction spends from YOUR vault, and the");
    println!("  sighash and randomizers you will sign are this transaction's own.");
    println!("  What is not: a shielded output need not state its value or recipient");
    println!("  in the clear. Where the transaction is silent above, nobody — including");
    println!("  you — can confirm the proposer's figure from this transaction alone.");
    println!("  ────────────────────────────────────────────────────────────");
}

/// Ask. Anything but an explicit yes is a no.
fn consent() -> Result<bool, String> {
    use std::io::Write;
    print!("  Approve and sign? [y/N] ");
    std::io::stdout().flush().map_err(|e| e.to_string())?;
    let mut line = String::new();
    std::io::stdin()
        .read_line(&mut line)
        .map_err(|e| e.to_string())?;
    Ok(matches!(line.trim(), "y" | "Y" | "yes" | "YES"))
}
