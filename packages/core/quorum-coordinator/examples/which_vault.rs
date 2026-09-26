//! Which vault does a PCZT belong to?
//!
//! ```sh
//! cargo run -p quorum-coordinator --example which_vault -- ./secrets/pczt/unsigned.pczt
//! ```
//!
//! A rehearsal tool, written after a three-process signing demo reported
//! APPROVED for a PCZT built by a different vault. The signatures were real
//! and the quorum was real; the transaction was somebody else's. Nothing in
//! the output said so, because nothing was checking.
//!
//! The coordinator now refuses that at submission. This exists so the
//! question "which vault is this transaction for?" has a one-command answer
//! before a recording starts, rather than a 400 in the middle of one.
use frost_core::keys::PublicKeyPackage;
use orchard::keys::SpendValidatingKey;
use quorum_coordinator::inspect;
use quorum_core::Ciphersuite;

fn main() {
    let mut args = std::env::args().skip(1);
    let pczt_path = args
        .next()
        .unwrap_or_else(|| "secrets/pczt/unsigned.pczt".to_string());
    let pczt = std::fs::read(&pczt_path).expect("read PCZT");

    let dirs: Vec<String> = args.collect();
    let dirs: Vec<&str> = if dirs.is_empty() {
        vec!["secrets/vault", "secrets/vault-3p", "secrets/ceremony"]
    } else {
        dirs.iter().map(String::as_str).collect()
    };

    println!("\n  {pczt_path}\n");
    for dir in dirs {
        let path = format!("{dir}/public-key-package.json");
        let Ok(raw) = std::fs::read(&path) else {
            println!("  {dir:22} no public-key-package.json");
            continue;
        };
        let pk: PublicKeyPackage<Ciphersuite> = serde_json::from_slice(&raw).expect("parse");
        let ak =
            SpendValidatingKey::from_bytes(&pk.verifying_key().serialize().unwrap()).expect("ak");
        match inspect(&pczt, &ak) {
            Ok(job) => println!(
                "  {dir:22} ✓ MATCHES — {} action(s) to sign",
                job.actions.len()
            ),
            Err(quorum_coordinator::PcztError::Transaction(
                quorum_core::transaction::TransactionError::WrongVault { .. },
            )) => {
                println!("  {dir:22} ✗ different vault")
            }
            Err(e) => println!("  {dir:22} ✗ {e}"),
        }
    }
    println!();
}
