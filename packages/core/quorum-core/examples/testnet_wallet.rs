//! Generate a Zcash **testnet** wallet, to be funded from a faucet.
//!
//! This is the source wallet for P0-B3 — not a vault. The vault does not
//! exist until a key ceremony produces it, and no single party ever holds its
//! spending key. This wallet is an ordinary one whose only job is to receive
//! faucet funds and then send them into the vault.
//!
//! ```sh
//! cargo run -p quorum-core --example testnet_wallet
//! ```
//!
//! # Testnet only
//!
//! Constraint C9 forbids mainnet for the whole build, and this deliberately
//! cannot produce a mainnet address. TAZ has no monetary value, which is the
//! only reason printing a seed to a terminal is acceptable here. Never reuse
//! this pattern for anything that holds real money.

use rand_core::{OsRng, RngCore};
use zcash_keys::keys::{UnifiedAddressRequest, UnifiedSpendingKey};
use zcash_protocol::consensus::TEST_NETWORK;
use zip32::AccountId;

fn main() {
    let mut seed = [0u8; 32];
    OsRng.fill_bytes(&mut seed);

    let account = AccountId::ZERO;
    let usk = UnifiedSpendingKey::from_seed(&TEST_NETWORK, &seed, account)
        .expect("derive a unified spending key");
    let ufvk = usk.to_unified_full_viewing_key();

    let (address, _) = ufvk
        .default_address(UnifiedAddressRequest::AllAvailableKeys)
        .expect("derive a unified address");

    println!();
    println!("  Zcash TESTNET wallet — P0-B3 source wallet");
    println!("  ------------------------------------------------------------");
    println!();
    println!("  Unified address (paste this into a faucet):");
    println!();
    println!("    {}", address.encode(&TEST_NETWORK));
    println!();
    println!("  Seed (32 bytes, hex) — this is the wallet. Keep it:");
    println!();
    println!("    {}", hex::encode(seed));
    println!();
    println!("  ------------------------------------------------------------");
    println!("  Store the seed where both developers can reach it, and NOT in");
    println!("  the repository — .gitignore already blocks keys/ and secrets/.");
    println!();
    println!("  Faucets:");
    println!("    https://zcashfaucet.jinolabs.xyz   0.1 TAZ, browser proof-of-work");
    println!("    https://fauzec.com                 pays to UA or Sapling");
    println!();
    println!("  A faucet pays into Sapling or a UA receiver. Gate B needs funds");
    println!("  in the IRONWOOD pool, so expect a self-transfer afterwards, and");
    println!("  verify which pool the note actually landed in before calling");
    println!("  P0-B3 done. See docs/04-technical-constraints.md C1.");
    println!();
}
