//! One participant in a distributed key ceremony.
//!
//! ```sh
//! # once, per participant — the identity they exchange out of band
//! quorum-dkgd keygen ./secrets/ceremony/alice.key
//!
//! # then, with a roster everyone has verified
//! QUORUM_DKG_ROSTER=./secrets/ceremony/roster.json \
//! QUORUM_DKG_IDENTITY=./secrets/ceremony/alice.key \
//! QUORUM_DKG_OUT=./secrets/ceremony \
//! QUORUM_DKG_PASSPHRASE=... \
//! QUORUM_DKG_CREATE_SESSION=1 \
//! QUORUM_DKG_SEED=contribute \
//!   quorum-dkgd
//! ```
//!
//! Three of these, on three machines, produce a vault whose shares were
//! never in the same place — including at the moment they were created.
//! That is the difference between this and `examples/ceremony.rs`, and it
//! is the difference between two claims the submission has to keep apart.
//!
//! # What this process holds
//!
//! One share, in memory, from round 3 until it is sealed to disk. It never
//! sends it. What goes over the relay is round-1 commitments, round-2
//! packages sealed to one named recipient, and a confirmation of the public
//! result.
//!
//! # The roster is trusted absolutely
//!
//! `Noise_K` takes both parties' static keys as given. Whoever controls the
//! roster file controls who is in the vault, and no later check will catch
//! a substituted key — the ceremony completes, the address looks fine, and
//! a stranger holds a share. Verifying it out of band is the security step;
//! this binary prints the fingerprints so a human can.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use quorum_core::transport::{FrostdClient, Identity, PeerPublicKey, PrivateKey, SessionId};
use quorum_signer::ceremony::{self, Roster, SeedRole, DEFAULT_ROUND_TIMEOUT};
use quorum_signer::store::seal;

fn need(key: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| {
        eprintln!("{key} is required");
        std::process::exit(2);
    })
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("keygen") {
        let path = args.get(2).cloned().unwrap_or_else(|| {
            eprintln!("usage: quorum-dkgd keygen <path>");
            std::process::exit(2);
        });
        keygen(Path::new(&path));
        return;
    }

    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    if let Err(e) = rt.block_on(ceremony_main()) {
        eprintln!("\n  CEREMONY FAILED\n  {e}\n");
        std::process::exit(1);
    }
}

/// Write a fresh X25519 identity and print the half to share.
fn keygen(path: &Path) {
    let identity = Identity::generate().expect("generate keypair");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("create directory");
    }
    fs::write(
        path,
        format!("{}\n", hex::encode(identity.private_key().as_bytes())),
    )
    .expect("write identity");

    // 0600. The private half is the right to act as this participant on the
    // relay — not the right to sign, but the right to join a ceremony, which
    // for a ceremony is the same thing.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }

    println!();
    println!("  identity written to {}", path.display());
    println!("  public key (give this to the others, and verify theirs):");
    println!();
    println!("    {}", identity.public_key().to_hex());
    println!();
}

fn load_identity(path: &Path) -> Identity {
    let text = fs::read_to_string(path).unwrap_or_else(|e| {
        eprintln!("cannot read identity {}: {e}", path.display());
        std::process::exit(1);
    });
    let raw = hex::decode(text.trim()).unwrap_or_else(|e| {
        eprintln!("identity {} is not hex: {e}", path.display());
        std::process::exit(1);
    });
    let bytes: [u8; 32] = raw.as_slice().try_into().unwrap_or_else(|_| {
        eprintln!(
            "identity {} must be 32 bytes, got {}",
            path.display(),
            raw.len()
        );
        std::process::exit(1);
    });
    Identity::from_private_key(PrivateKey::from_bytes(bytes)).unwrap_or_else(|e| {
        eprintln!(
            "identity {} is not a usable X25519 key: {e}",
            path.display()
        );
        std::process::exit(1);
    })
}

async fn ceremony_main() -> Result<(), Box<dyn std::error::Error>> {
    let url = std::env::var("QUORUM_FROSTD_URL").unwrap_or_else(|_| "http://127.0.0.1:2744".into());
    let roster_path = PathBuf::from(need("QUORUM_DKG_ROSTER"));
    let identity_path = PathBuf::from(need("QUORUM_DKG_IDENTITY"));
    let out = PathBuf::from(need("QUORUM_DKG_OUT"));
    let passphrase = need("QUORUM_DKG_PASSPHRASE");
    let creates_session = std::env::var("QUORUM_DKG_CREATE_SESSION").as_deref() == Ok("1");
    let seed_role = match std::env::var("QUORUM_DKG_SEED").as_deref() {
        Ok("contribute") if std::env::var("QUORUM_DKG_MISBEHAVE_SEED").as_deref() == Ok("1") => {
            eprintln!(
                "  MISBEHAVE MODE — sending a different vault seed to each peer. \
                 The confirmation round should abort this ceremony."
            );
            SeedRole::ContributeInconsistently
        }
        Ok("contribute") => SeedRole::Contribute,
        _ => SeedRole::Await,
    };
    let timeout = std::env::var("QUORUM_DKG_TIMEOUT_SECS")
        .ok()
        .and_then(|s| s.parse().ok())
        .map(Duration::from_secs)
        .unwrap_or(DEFAULT_ROUND_TIMEOUT);

    let identity = load_identity(&identity_path);
    let roster: Roster = serde_json::from_slice(&fs::read(&roster_path)?)?;

    let me = roster
        .participants
        .iter()
        .find(|m| {
            m.pubkey
                .eq_ignore_ascii_case(&identity.public_key().to_hex())
        })
        .ok_or("our public key is not in the roster; we were not invited")?
        .clone();

    println!();
    println!(
        "  {} — {}-of-{}",
        me.label,
        roster.threshold,
        roster.participants.len()
    );
    println!("  ------------------------------------------------------------");
    println!("  Roster (verify these out of band; Noise_K trusts them absolutely):");
    for m in &roster.participants {
        let mark = if m.label == me.label { "you" } else { "   " };
        println!("    {mark}  {:<8} {}", m.label, &m.pubkey[..16]);
    }
    println!();

    let mut client = FrostdClient::new(&url);
    client.login(&identity, rand::thread_rng()).await?;
    println!("  logged in to {url}");

    let session = if creates_session {
        // Every participant, INCLUDING us. frostd keeps the session
        // coordinator separate from `pubkeys` — leave ourselves out and
        // peers get NotInSession trying to reach us, while our own receive
        // queue stays empty and the round times out with no clue why.
        let everyone: Vec<PeerPublicKey> = roster
            .participants
            .iter()
            .map(|m| PeerPublicKey::from_hex(&m.pubkey))
            .collect::<Result<_, _>>()?;
        let id = client.create_session(&everyone, 1).await?;
        println!("  opened session {id}");
        id
    } else {
        let id = await_session(&client, timeout).await?;
        println!("  joined session {id}");
        id
    };

    println!("  running the ceremony — three rounds and a confirmation");
    let outcome = ceremony::run(
        &identity,
        &roster,
        &client,
        session,
        seed_role,
        timeout,
        rand::thread_rng(),
    )
    .await?;

    // ── Persist. Our share goes in our own directory and nowhere else. ──
    let index = u16::from_le_bytes(
        outcome.key_package.identifier().serialize()[..2]
            .try_into()
            .expect("identifier is at least 2 bytes"),
    );
    let mine = out.join(me.label.to_lowercase());
    fs::create_dir_all(&mine)?;
    let sealed = seal(&outcome.key_package, &passphrase, &mut rand::thread_rng())?;
    fs::write(mine.join(format!("share-{index}.bin")), &sealed)?;

    // Public artifacts are identical for everyone — the confirmation round
    // is what makes that true rather than hoped for. Written atomically
    // because all three participants race to write them.
    fs::create_dir_all(&out)?;
    write_atomic(
        &out.join("public-key-package.json"),
        &serde_json::to_vec_pretty(&outcome.public_key_package)?,
    )?;
    write_atomic(
        &out.join("vault-address.txt"),
        format!("{}\n", outcome.address).as_bytes(),
    )?;
    let coordinator_roster: Vec<_> = roster
        .participants
        .iter()
        .map(|m| serde_json::json!({ "id": m.identifier, "label": m.label }))
        .collect();
    write_atomic(
        &out.join("participants.json"),
        &serde_json::to_vec_pretty(&coordinator_roster)?,
    )?;
    write_atomic(
        &out.join("vault-seed.hex"),
        format!("{}\n", hex::encode(outcome.seed.as_bytes())).as_bytes(),
    )?;

    if creates_session {
        let _ = client.close_session(session).await;
    }
    let _ = client.logout().await;

    println!();
    println!("  ✓ ceremony complete — {}", me.label);
    println!("  ------------------------------------------------------------");
    println!("  Address (testnet):");
    println!();
    println!("    {}", outcome.address);
    println!();
    println!("  {}/share-{index}.bin", mine.display());
    println!("      your share, sealed. This process is the only one that has");
    println!("      ever held it, and it was never sent anywhere.");
    println!();
    println!("  {}/vault-seed.hex", out.display());
    println!("      SHARED SECRET — needed to scan, and enough to read the");
    println!("      vault's entire history. Not enough to spend.");
    println!();

    Ok(())
}

/// Wait for the coordinator to open our session.
///
/// A participant can be in several sessions at once, so more than one is
/// ambiguous rather than a lucky guess — the caller must then say which.
async fn await_session(
    client: &FrostdClient,
    timeout: Duration,
) -> Result<SessionId, Box<dyn std::error::Error>> {
    if let Ok(explicit) = std::env::var("QUORUM_DKG_SESSION") {
        return Ok(explicit.parse()?);
    }

    let deadline = tokio::time::Instant::now() + timeout;
    loop {
        let sessions = client.list_sessions().await?;
        match sessions.len() {
            1 => return Ok(sessions[0]),
            0 => {}
            n => {
                return Err(format!(
                    "we are in {n} sessions; set QUORUM_DKG_SESSION to say which one"
                )
                .into())
            }
        }
        if tokio::time::Instant::now() >= deadline {
            return Err(format!(
                "no session was opened within {}s — is the coordinator running?",
                timeout.as_secs()
            )
            .into());
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
}

/// Write via a temporary file and rename, so a concurrent reader never sees
/// half a file and two concurrent writers never interleave.
fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let tmp = path.with_extension(format!("tmp{}", std::process::id()));
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path)
}
