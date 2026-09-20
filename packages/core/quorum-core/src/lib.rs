// quorum-core — FROST wrapper types and DKG orchestration
//
// Placeholder: Dev A implements this after spike S1.
// See docs/10-roadmap.md P1-A1.
//
// The ciphersuite binding below is deliberately NOT a placeholder. It is
// the compile-time proof that the RedPallas wiring is correct — without
// it, a wrong ciphersuite in Cargo.toml stays invisible until someone
// writes signing code and discovers their signatures authorize nothing
// on Zcash. See docs/04-technical-constraints.md §C4.

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
