//! Export a vault's unified full viewing key.
//!
//! ```sh
//! cargo run -p quorum-signer --example vault_ufvk -- ./secrets/vault
//! ```
//!
//! The UFVK is what lets anything scan the chain for the vault's notes — our
//! own scanner, or a watch-only wallet used to cross-check it. Reconstructed
//! from the ceremony's saved output, which is the point: if this does not
//! reproduce the same address the ceremony printed, persistence is broken and
//! the vault's funds are unreachable.
//!
//! # It is a secret
//!
//! A full viewing key grants no spend authority and reveals the vault's
//! entire transaction history. Treat the output like the seed it came from.

use std::env;
use std::fs;
use std::path::PathBuf;

use frost_core::keys::PublicKeyPackage;
use quorum_core::vault_key::{VaultKey, VaultSeed};
use quorum_core::Ciphersuite;
use zcash_keys::address::UnifiedAddress;
use zcash_keys::keys::UnifiedFullViewingKey;
use zcash_protocol::consensus::TEST_NETWORK;

fn main() {
    let dir: PathBuf = env::args()
        .nth(1)
        .unwrap_or_else(|| "./secrets/vault".to_string())
        .into();

    let pubkeys: PublicKeyPackage<Ciphersuite> = serde_json::from_slice(
        &fs::read(dir.join("public-key-package.json")).expect("read pubkeys"),
    )
    .expect("parse pubkeys");

    let seed_hex = fs::read_to_string(dir.join("vault-seed.hex")).expect("read vault seed");
    let seed_bytes: [u8; 32] = hex::decode(seed_hex.trim())
        .expect("seed is hex")
        .try_into()
        .expect("seed is 32 bytes");
    let seed = VaultSeed::from_bytes(seed_bytes);

    let vault = VaultKey::derive(&pubkeys, &seed).expect("derive vault key");

    let ufvk = UnifiedFullViewingKey::from_orchard_fvk(vault.full_viewing_key().clone())
        .expect("a vault has an Orchard receiver, which is a valid UFVK");

    let address = UnifiedAddress::from_receivers(Some(vault.address()), None, None)
        .expect("valid unified address")
        .encode(&TEST_NETWORK);

    // The check that matters. If this disagrees with what the ceremony wrote,
    // the saved seed does not reproduce the vault and the funds are gone.
    let expected = fs::read_to_string(dir.join("vault-address.txt")).expect("read address");
    let matches = expected.trim() == address;

    println!();
    println!("  Vault UFVK");
    println!("  ------------------------------------------------------------");
    println!();
    println!("    {}", ufvk.encode(&TEST_NETWORK));
    println!();
    println!("  Address: {address}");
    println!(
        "  Reproduces the ceremony's address: {}",
        if matches {
            "YES"
        } else {
            "NO — PERSISTENCE IS BROKEN"
        }
    );
    println!();
    if !matches {
        eprintln!("  The saved seed does not reproduce this vault. Anything sent to");
        eprintln!("  the ceremony's address cannot be found or spent. Do not fund it.");
        std::process::exit(1);
    }
}
