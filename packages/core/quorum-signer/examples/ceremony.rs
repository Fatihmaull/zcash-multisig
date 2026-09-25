//! Run a 2-of-3 key ceremony and produce a fundable vault.
//!
//! ```sh
//! cargo run -p quorum-signer --example ceremony -- ./secrets/vault
//! ```
//!
//! Writes three passphrase-sealed key packages, the public key package, and
//! prints the vault's Zcash address.
//!
//! # This runs the ceremony in one process
//!
//! **That is a development fixture, not the product.** A real ceremony runs
//! across three machines over `frostd`, and Gate B requires that — the whole
//! claim is that no single party ever sees more than one share, and here one
//! process briefly sees all three.
//!
//! It exists because the transport-free DKG module and the `frostd` client
//! are both tested, so wiring them into three processes is plumbing rather
//! than risk — and we need a fundable address *now* so testnet funds can sit
//! in the vault while that plumbing gets written.
//!
//! Do not use this to create a vault anyone cares about.

use std::collections::BTreeMap;
use std::env;
use std::fs;
use std::path::PathBuf;

use quorum_core::dkg::{Finished, Round1, Round2, VaultConfig, VaultIdentifier};
use quorum_core::vault_key::{VaultKey, VaultSeed};
use quorum_signer::store::seal;
use zcash_keys::address::UnifiedAddress;
use zcash_protocol::consensus::TEST_NETWORK;

/// Dev fixture only — a real participant chooses their own passphrase and
/// never types it where another participant can see it.
const DEV_PASSPHRASE: &str = "quorum-dev-fixture";

fn main() {
    let out: PathBuf = env::args()
        .nth(1)
        .unwrap_or_else(|| "./secrets/vault".to_string())
        .into();
    fs::create_dir_all(&out).expect("create output directory");

    let mut rng = rand::thread_rng();
    let config = VaultConfig::new(2, 3).expect("2-of-3");

    // ── Round 1 — every participant commits and broadcasts ──
    let ids: Vec<VaultIdentifier> = (1..=3u16)
        .map(|i| VaultIdentifier::try_from(i).expect("identifier"))
        .collect();

    let round1: Vec<Round1> = ids
        .iter()
        .map(|id| Round1::begin(*id, config, &mut rng).expect("round 1"))
        .collect();

    let broadcast: BTreeMap<_, _> = round1
        .iter()
        .map(|r| (r.identifier(), r.broadcast_package().clone()))
        .collect();

    // ── Round 2 — each sees everyone else's round 1 ──
    let round2: Vec<Round2> = round1
        .into_iter()
        .map(|r| {
            let me = r.identifier();
            let others = broadcast
                .iter()
                .filter(|(id, _)| **id != me)
                .map(|(id, p)| (*id, p.clone()))
                .collect();
            r.receive(others).expect("round 2")
        })
        .collect();

    // Round-2 packages are per-recipient and secret. Over the wire these go
    // through the Noise layer; here they move in memory, which is exactly
    // why this is a fixture.
    let mut inbox: BTreeMap<VaultIdentifier, BTreeMap<VaultIdentifier, _>> = BTreeMap::new();
    for r in &round2 {
        for (recipient, pkg) in r.packages_to_send() {
            inbox
                .entry(*recipient)
                .or_default()
                .insert(r.identifier(), pkg.clone());
        }
    }

    // ── Round 3 ──
    let finished: BTreeMap<VaultIdentifier, Finished> = round2
        .into_iter()
        .map(|r| {
            let me = r.identifier();
            let mine = inbox.remove(&me).unwrap_or_default();
            (me, r.receive(mine).expect("round 3"))
        })
        .collect();

    // Every participant must agree on the group key, or their shares belong
    // to different vaults and no threshold of them can ever sign together.
    let group_keys: Vec<_> = finished
        .values()
        .map(|f| {
            f.public_key_package
                .verifying_key()
                .serialize()
                .expect("ser")
        })
        .collect();
    assert!(
        group_keys.windows(2).all(|w| w[0] == w[1]),
        "participants disagreed on the group key"
    );

    let any = finished.values().next().expect("a participant");

    // Generated ONCE, here, and persisted. It fixes nk and rivk, so it is
    // what makes the vault's notes findable — and what makes the address
    // reproducible. A version that drew this inside `derive` produced a new
    // vault on every call and stranded real testnet funds.
    //
    // It is a shared secret, not a public value: every participant needs it
    // to scan, and anyone who has it can read the vault's whole history. In
    // the distributed ceremony it travels over the Noise channel alongside
    // the round-2 packages.
    let seed = VaultSeed::generate(&mut rng);
    let vault = VaultKey::derive(&any.public_key_package, &seed).expect("derive vault key");
    // A unified address carrying only the Orchard receiver. Ironwood reuses
    // Orchard's address format, so the same receiver serves both pools —
    // which pool a note lands in is the sender's choice, not the address's.
    // That is why the faucet was able to pay straight into Ironwood.
    let address = UnifiedAddress::from_receivers(Some(vault.address()), None, None)
        .expect("an Orchard receiver is a valid unified address")
        .encode(&TEST_NETWORK);

    // ── Persist ──
    for (id, f) in &finished {
        let sealed = seal(&f.key_package, DEV_PASSPHRASE, &mut rng).expect("seal share");
        let index = u16::from_le_bytes(
            id.serialize()[..2]
                .try_into()
                .expect("identifier is at least 2 bytes"),
        );
        fs::write(out.join(format!("share-{index}.bin")), &sealed).expect("write share");
    }
    fs::write(
        out.join("public-key-package.json"),
        serde_json::to_vec_pretty(&any.public_key_package).expect("serialise pubkeys"),
    )
    .expect("write pubkeys");
    fs::write(out.join("vault-address.txt"), format!("{address}\n")).expect("write address");
    // The demo and the signer daemons need identifiers in the same hex form
    // the coordinator speaks. Deriving them by hand from share filenames is
    // how you end up with a signer nobody can authenticate.
    let roster: Vec<_> = finished
        .keys()
        .zip(["Alice", "Bob", "Carol"])
        .map(|(id, label)| serde_json::json!({ "id": hex::encode(id.serialize()), "label": label }))
        .collect();
    fs::write(
        out.join("participants.json"),
        serde_json::to_vec_pretty(&roster).expect("serialise roster"),
    )
    .expect("write roster");

    fs::write(
        out.join("vault-seed.hex"),
        format!("{}\n", hex::encode(seed.as_bytes())),
    )
    .expect("write vault seed");

    println!();
    println!("  2-of-3 vault created");
    println!("  ------------------------------------------------------------");
    println!("  Address (testnet):");
    println!();
    println!("    {address}");
    println!();
    println!("  Written to {}:", out.display());
    println!("    share-1.bin, share-2.bin, share-3.bin   sealed with a DEV passphrase");
    println!("    public-key-package.json                 public, needed by the coordinator");
    println!("    vault-address.txt");
    println!("    participants.json                       hex identifiers + labels");
    println!("    vault-seed.hex          SHARED SECRET — every participant needs it to");
    println!("                            scan, and anyone holding it can read the vault's");
    println!("                            entire history. Lose it and the funds are gone.");
    println!();
    println!("  This ceremony ran in ONE process. Gate B needs three, over frostd.");
    println!("  Do not create a vault you care about with this.");
    println!();
}
