//! The participant's communication identity.
//!
//! One X25519 keypair does two jobs:
//!
//! - **Noise static key.** `Noise_K` needs both parties' static public keys
//!   up front, and this is ours.
//! - **frostd login.** The server issues a challenge; we sign it with the
//!   *same* key via XEdDSA, which is exactly what XEdDSA is for — producing
//!   signatures from a key otherwise used for Diffie-Hellman.
//!
//! Keeping it to one key means a participant has one thing to exchange and
//! one thing to verify. Two keys would mean two chances to verify the wrong
//! one.
//!
//! # This is not a FROST key share
//!
//! This key authenticates a *channel*. It grants no authority over funds:
//! stealing it lets an attacker impersonate a participant on the relay, which
//! is serious — they could join a ceremony — but it does not let them sign.
//! The share is a separate secret, and it never travels.

use rand_core::{CryptoRng, RngCore};
use serde::{Deserialize, Serialize};
use xeddsa::{xed25519, Sign as _};

#[derive(Debug, thiserror::Error)]
pub enum IdentityError {
    #[error("noise error: {0}")]
    Noise(#[from] snow::Error),
    #[error("a key must be exactly 32 bytes, got {0}")]
    BadLength(usize),
    #[error("not valid hex: {0}")]
    BadHex(#[from] hex::FromHexError),
}

/// A participant's X25519 private key.
///
/// Deliberately not `Clone`, `Debug` or `Serialize`: it should be awkward to
/// copy and impossible to print by accident.
pub struct PrivateKey([u8; 32]);

impl PrivateKey {
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    /// Sign frostd's login challenge.
    ///
    /// XEdDSA over the X25519 key. The signature is randomised, so two
    /// signatures over the same challenge differ — that is expected, not a
    /// bug.
    pub fn sign_challenge<R: RngCore + CryptoRng>(&self, challenge: &[u8], rng: R) -> [u8; 64] {
        let key = xed25519::PrivateKey::from(&self.0);
        key.sign(challenge, rng)
    }
}

/// A peer's X25519 public key. Safe to log, print and exchange.
#[derive(Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PeerPublicKey(#[serde(with = "hex_bytes")] [u8; 32]);

impl PeerPublicKey {
    pub fn as_bytes(&self) -> &[u8; 32] {
        &self.0
    }

    pub fn from_bytes(bytes: [u8; 32]) -> Self {
        Self(bytes)
    }

    pub fn to_hex(&self) -> String {
        hex::encode(self.0)
    }

    pub fn from_hex(s: &str) -> Result<Self, IdentityError> {
        let raw = hex::decode(s)?;
        let bytes: [u8; 32] = raw
            .as_slice()
            .try_into()
            .map_err(|_| IdentityError::BadLength(raw.len()))?;
        Ok(Self(bytes))
    }
}

impl std::fmt::Debug for PeerPublicKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Short form: full keys in logs are noise, and the prefix is enough
        // to tell participants apart while debugging.
        write!(f, "PeerPublicKey({}…)", &self.to_hex()[..8])
    }
}

/// A participant's own keypair.
pub struct Identity {
    private: PrivateKey,
    public: PeerPublicKey,
}

impl Identity {
    /// Generate a fresh identity.
    ///
    /// Uses `snow`'s generator so the key is guaranteed valid for the Noise
    /// pattern rather than merely 32 random bytes.
    pub fn generate() -> Result<Self, IdentityError> {
        let keypair = snow::Builder::new(
            "Noise_K_25519_ChaChaPoly_BLAKE2s"
                .parse()
                .expect("valid pattern"),
        )
        .generate_keypair()?;

        let private: [u8; 32] = keypair
            .private
            .as_slice()
            .try_into()
            .map_err(|_| IdentityError::BadLength(keypair.private.len()))?;
        let public: [u8; 32] = keypair
            .public
            .as_slice()
            .try_into()
            .map_err(|_| IdentityError::BadLength(keypair.public.len()))?;

        Ok(Self {
            private: PrivateKey(private),
            public: PeerPublicKey(public),
        })
    }

    /// Rebuild an identity from a stored private key.
    ///
    /// The public half is derived rather than stored alongside, so a
    /// tampered or truncated identity file cannot produce a keypair whose
    /// halves disagree — which would fail later, during a Noise handshake,
    /// as an unexplained decryption error rather than as a bad key.
    pub fn from_private_key(private: PrivateKey) -> Result<Self, IdentityError> {
        let secret = x25519_dalek::StaticSecret::from(*private.as_bytes());
        let public = x25519_dalek::PublicKey::from(&secret);
        Ok(Self {
            private,
            public: PeerPublicKey(public.to_bytes()),
        })
    }

    pub fn private_key(&self) -> &PrivateKey {
        &self.private
    }

    /// The half you give to the other participants. Verify it out of band —
    /// `Noise_K` assumes it is correct, and an attacker who substitutes one
    /// here is inside the vault from key generation onward.
    pub fn public_key(&self) -> &PeerPublicKey {
        &self.public
    }
}

mod hex_bytes {
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S: Serializer>(bytes: &[u8; 32], s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&hex::encode(bytes))
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<[u8; 32], D::Error> {
        let s = String::deserialize(d)?;
        let raw = hex::decode(&s).map_err(serde::de::Error::custom)?;
        raw.as_slice()
            .try_into()
            .map_err(|_| serde::de::Error::custom(format!("expected 32 bytes, got {}", raw.len())))
    }
}
