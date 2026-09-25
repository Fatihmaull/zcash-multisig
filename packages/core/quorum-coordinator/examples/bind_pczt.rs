//! Rebind a fixture transaction to a throwaway vault. **Tests only.**
//!
//! ```sh
//! cargo run -p quorum-coordinator --example bind_pczt -- <in.pczt> <vault-dir> <out.pczt>
//! ```
//!
//! # Why this exists
//!
//! The coordinator refuses a PCZT whose `rk` is not the vault's `ak`
//! randomized by the action's own `alpha`. That check is correct — without
//! it a vault will happily produce a valid FROST signature over somebody
//! else's transaction — but it means an integration test needs a
//! transaction and a vault that belong together.
//!
//! The obvious way to get one is to commit the fixture vault's key shares.
//! We are not going to do that. A shared-custody product does not keep key
//! material in its repository, and on 25 September we briefly did, which is
//! the whole reason this file is here.
//!
//! So the transaction is bound to the vault instead. `rk` depends only on
//! `ak` and `alpha`, both public, so recomputing it is arithmetic on public
//! data — no secret is needed and none is stored.
//!
//! # This produces a transaction no node will accept
//!
//! The zk-proof still commits to the original key, so the result is
//! unbroadcastable by construction. That is deliberate: it is enough to
//! exercise the coordinator's contract end to end and impossible to
//! mistake for a real transaction. Anything that must actually reach the
//! chain goes through `scripts/three-signer-demo.sh` with a vault and a
//! PCZT that genuinely belong together.

use ff::PrimeField;
use frost_core::keys::PublicKeyPackage;
use orchard::keys::SpendValidatingKey;
use pasta_curves::pallas;
use quorum_core::Ciphersuite;

fn main() {
    let mut args = std::env::args().skip(1);
    let input = args
        .next()
        .expect("usage: <in.pczt> <vault-dir> <out.pczt>");
    let vault_dir = args.next().expect("missing vault directory");
    let output = args.next().expect("missing output path");

    // A PCZT may be raw bytes or hex; the web fixture is hex.
    let raw = std::fs::read(&input).expect("read input");
    let mut bytes = match std::str::from_utf8(&raw).ok().map(str::trim) {
        Some(text) if !text.is_empty() && text.bytes().all(|b| b.is_ascii_hexdigit()) => {
            hex::decode(text).expect("hex input")
        }
        _ => raw,
    };

    let pubkeys: PublicKeyPackage<Ciphersuite> = serde_json::from_slice(
        &std::fs::read(format!("{vault_dir}/public-key-package.json")).expect("read pubkeys"),
    )
    .expect("parse pubkeys");
    let ak = SpendValidatingKey::from_bytes(
        &pubkeys
            .verifying_key()
            .serialize()
            .expect("serialise group key"),
    )
    .expect("a FROST group key is a valid Orchard ak");

    let spends = quorum_coordinator::spend_keys(&bytes).expect("parse PCZT");
    assert!(!spends.is_empty(), "no unsigned spends to rebind");

    for spend in &spends {
        let alpha = pallas::Scalar::from_repr(spend.alpha)
            .into_option()
            .expect("alpha is a scalar");
        let wanted: [u8; 32] = (&ak.randomize(&alpha)).into();

        // Locate the old key by value, and insist it appears exactly once.
        // A blind replacement is only safe while that holds; if the encoding
        // ever changes shape this fails loudly instead of corrupting a
        // neighbouring field.
        let hits: Vec<usize> = bytes
            .windows(32)
            .enumerate()
            .filter(|(_, w)| *w == spend.rk)
            .map(|(i, _)| i)
            .collect();
        assert_eq!(
            hits.len(),
            1,
            "expected rk for action {} exactly once, found {}",
            spend.index,
            hits.len()
        );
        bytes[hits[0]..hits[0] + 32].copy_from_slice(&wanted);
    }

    // It must now be this vault's transaction, or the rebind silently did
    // nothing and the test would fail somewhere far from the cause.
    quorum_coordinator::inspect(&bytes, &ak).expect("rebound PCZT must bind to this vault");

    std::fs::write(&output, hex::encode(&bytes)).expect("write output");
    println!("{output}");
}
