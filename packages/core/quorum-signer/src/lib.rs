//! quorum-signer — the participant side.
//!
//! Runs on the participant's own machine and is the only place a key share
//! ever exists in usable form. The coordinator never sees one, the browser
//! never sees one, and our servers never see one.
//!
//! - [`store`] — the share at rest, behind a passphrase.
//! - [`session`] — the two FROST rounds, with the nonce lifecycle enforced by
//!   the type system rather than by care.
//!
//! See `docs/03-architecture.md` §2.

pub mod session;
pub mod store;

pub use session::{SignerError, SigningSession};
pub use store::{open, seal, StoreError};
