//! Talking to `frostd`.
//!
//! `frostd` is the Zcash Foundation's relay for FROST participants. We speak
//! its protocol but do not use its client library: `frost-client` is not
//! published to crates.io and is pinned to `frost-core 2.2.0`, so depending
//! on it would drag a second, incompatible FROST into the tree. Fortunately
//! the relay carries **opaque bytes** — our v3 types travel over it untouched.
//!
//! Three pieces:
//!
//! - [`identity`] — the X25519 keypair that is both the frostd login identity
//!   and the Noise static key. One key, two jobs, via XEdDSA.
//! - [`cipher`] — end-to-end Noise between participants, so the relay cannot
//!   read what it carries.
//! - [`client`] — the HTTP calls.
//!
//! # What the relay can and cannot do
//!
//! It can see who is in a session and refuse to pass messages along, stalling
//! a ceremony or a signing round. That is a liveness attack and we accept it.
//!
//! It cannot read round-2 DKG packages or signature shares, and it cannot
//! move funds: below threshold the signature does not exist. See
//! `docs/03-architecture.md` §2.

pub mod cipher;
pub mod client;
pub mod identity;

pub use cipher::{Cipher, CipherError};
pub use client::{FrostdClient, FrostdError, SessionId};
pub use identity::{Identity, IdentityError, PeerPublicKey, PrivateKey};
