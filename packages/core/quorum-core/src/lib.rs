//! quorum-core — the parts both sides of the trust boundary need.
//!
//! - [`dkg`] — distributed key generation as a typestate. Moves no bytes;
//!   delivery is the caller's business, which is what lets the protocol be
//!   tested exhaustively with no node and no network.
//! - [`transport`] — our own `frostd` client: XEdDSA login, sessions, and
//!   `Noise_K` end to end so the relay carries ciphertext it cannot read.
//! - [`transaction`] — reading a PCZT. Shared deliberately: a signer that
//!   cannot read the transaction has to take the coordinator's word for what
//!   it is signing. Writing signatures back stays in the coordinator.
//! - [`vault_key`] — the vault's viewing key, derived from a group key nobody
//!   holds the spending key for.
//!
//! Nothing here holds a share. `quorum-signer` does, and only ever one.

// The ciphersuite binding below is deliberately load-bearing. It is
// the compile-time proof that the RedPallas wiring is correct — without
// it, a wrong ciphersuite in Cargo.toml stays invisible until someone
// writes signing code and discovers their signatures authorize nothing
// on Zcash. See docs/04-technical-constraints.md §C4.

pub mod dkg;
pub mod transaction;
pub mod transport;
pub mod vault_key;

/// The Zcash-compatible ciphersuite: RedDSA over the Pallas curve.
///
/// Selecting RedPallas is what makes FROST signatures valid as Zcash
/// spend authorizations, and it automatically engages *rerandomized*
/// FROST — `PallasBlake2b512` implements `RandomizedCiphersuite`, which
/// the assertion below pins.
///
/// Never substitute a default ciphersuite such as Ed25519. Signatures
/// would still verify against their own scheme and would authorize
/// nothing on Zcash.
pub type Ciphersuite = reddsa::frost::redpallas::PallasBlake2b512;

/// Compile-time assertions. These cost nothing at runtime and fail the
/// build the moment the ciphersuite wiring regresses.
const _: () = {
    // Must be a FROST ciphersuite.
    fn assert_ciphersuite<C: frost_core::Ciphersuite>() {}
    // Must additionally support rerandomization — this is the property
    // Zcash spend authorization depends on, and the reason the default
    // ciphersuites are unusable here.
    fn assert_randomized<C: frost_rerandomized::RandomizedCiphersuite>() {}

    let _ = assert_ciphersuite::<Ciphersuite>;
    let _ = assert_randomized::<Ciphersuite>;
};
