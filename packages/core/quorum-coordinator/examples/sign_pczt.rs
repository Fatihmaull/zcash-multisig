//! Threshold-sign a PCZT with a 2-of-3 vault.
//!
//! ```sh
//! cargo run -p quorum-coordinator --example sign_pczt -- \
//!     ./secrets/vault ./secrets/pczt/unsigned.pczt ./secrets/pczt/signed.pczt
//! ```
//!
//! The wallet builds the transaction; we only authorize it. Read the sighash
//! and each action's randomizer out of the PCZT, run two FROST rounds across
//! the vault's shares, and write the signatures back.
//!
//! # A dev fixture, not the product
//!
//! It opens all three shares in one process. The real flow has each share on
//! its own machine, talking over `frostd` — which is what Gate B requires and
//! what makes the non-custodial claim true. This exists to prove the
//! cryptography lines up with a real transaction before the plumbing is
//! wired.

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::PathBuf;

use frost_core::keys::{KeyPackage, PublicKeyPackage};
use quorum_coordinator::{inspect, CollectingCommitments};
use quorum_core::Ciphersuite;
use quorum_signer::{store::open, SigningSession};

const DEV_PASSPHRASE: &str = "quorum-dev-fixture";
const THRESHOLD: u16 = 2;

fn main() {
    let mut args = env::args().skip(1);
    let vault_dir: PathBuf = args
        .next()
        .expect("usage: <vault-dir> <in.pczt> <out.pczt>")
        .into();
    let pczt_in: PathBuf = args.next().expect("missing input PCZT").into();
    let pczt_out: PathBuf = args.next().expect("missing output path").into();

    let pczt_bytes = fs::read(&pczt_in).expect("read PCZT");

    // ── What does this transaction need authorized? ──
    let job = inspect(&pczt_bytes).expect("inspect PCZT");
    println!();
    println!("  sighash : {}", hex::encode(job.sighash));
    println!("  actions : {}", job.actions.len());
    for a in &job.actions {
        println!(
            "    [{}] {:?}  alpha {}…",
            a.index,
            a.pool,
            &hex::encode(a.alpha)[..16]
        );
    }

    // ── Load the vault ──
    let pubkeys: PublicKeyPackage<Ciphersuite> = serde_json::from_slice(
        &fs::read(vault_dir.join("public-key-package.json")).expect("read pubkeys"),
    )
    .expect("parse pubkeys");

    // Two of three. Which two is the treasurer's problem, not ours.
    let mut key_packages: BTreeMap<_, KeyPackage<Ciphersuite>> = BTreeMap::new();
    for i in 1..=THRESHOLD {
        let sealed = fs::read(vault_dir.join(format!("share-{i}.bin"))).expect("read share");
        let kp = open(&sealed, DEV_PASSPHRASE).expect("unseal share");
        key_packages.insert(*kp.identifier(), kp);
    }

    let mut rng = rand::thread_rng();
    let mut round =
        CollectingCommitments::new(job.sighash.to_vec(), job.actions.clone(), THRESHOLD)
            .expect("start round");

    // ── Round 1 ──
    let mut sessions = Vec::new();
    for kp in key_packages.values() {
        let s = SigningSession::begin(kp, job.actions.len(), &mut rng).expect("round 1");
        round
            .add(s.identifier(), s.commitments().to_vec())
            .expect("commitments");
        sessions.push(s);
    }

    // ── Round 2 ──
    let mut round = round.build().expect("threshold reached");
    let packages = round.signing_packages().to_vec();
    let randomizers = round.randomizers();

    for s in sessions {
        let id = s.identifier();
        let shares = s
            .sign(&key_packages[&id], &packages, &randomizers)
            .expect("round 2");
        round.add(id, shares).expect("shares");
    }

    let signatures = round.aggregate(&pubkeys).expect("aggregate");
    println!("  signed  : {} signature(s)", signatures.len());

    // ── Back into the transaction ──
    let signed = quorum_coordinator::apply(&pczt_bytes, &job.actions, &signatures)
        .expect("apply signatures");
    fs::write(&pczt_out, &signed).expect("write signed PCZT");

    // If a signature were wrong, `apply` would have refused — orchard checks
    // it against the randomized key before accepting.
    let after = inspect(&signed);
    println!();
    println!("  wrote {} ({} bytes)", pczt_out.display(), signed.len());
    match after {
        Err(_) => println!("  no unsigned spends remain — fully authorized"),
        Ok(j) => println!("  ⚠ {} spend(s) still unsigned", j.actions.len()),
    }
    println!();
}
