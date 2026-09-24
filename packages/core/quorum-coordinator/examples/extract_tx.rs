//! Extract the raw transaction from a proved, signed PCZT.
//!
//! ```sh
//! cargo run -p quorum-coordinator --example extract_tx -- in.pczt out.tx
//! ```
//!
//! `zcash-devtool pczt extract` prints the txid and throws the transaction
//! away, which is fine for its purposes and useless for ours — we need the
//! bytes to broadcast. This keeps them.

use std::env;
use std::fs;

use pczt::roles::{spend_finalizer::SpendFinalizer, tx_extractor::TransactionExtractor};
use pczt::Pczt;

fn main() {
    let mut args = env::args().skip(1);
    let input = args.next().expect("usage: <in.pczt> <out.tx>");
    let output = args.next().expect("missing output path");

    let pczt = Pczt::parse(&fs::read(&input).expect("read PCZT")).expect("parse PCZT");

    // Turns each authorized spend into its final form. Fails if anything is
    // still unsigned — which is the check we want before broadcasting.
    let finalized = SpendFinalizer::new(pczt)
        .finalize_spends()
        .expect("finalize spends — is every spend signed?");

    let tx = TransactionExtractor::new(finalized)
        .extract()
        .expect("extract transaction");

    let mut bytes = Vec::new();
    tx.write(&mut bytes).expect("serialise transaction");
    fs::write(&output, &bytes).expect("write transaction");

    println!();
    println!("  txid : {}", tx.txid());
    println!("  size : {} bytes", bytes.len());
    println!("  wrote {output}");
    println!();
}
