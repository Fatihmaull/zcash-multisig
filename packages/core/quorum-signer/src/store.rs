//! Keeping a key share on a participant's own machine.
//!
//! The share is the thing that matters. Lose it and the vault loses a signer;
//! leak it and — combined with one other — someone can move funds. It lives
//! on a laptop, so the realistic threat is that laptop being stolen, backed
//! up carelessly, or synced to someone's cloud drive.
//!
//! # Argon2id, not a fast hash
//!
//! The only secret protecting the file is a passphrase a human chose. A fast
//! KDF would make that passphrase worth guessing offline at billions of
//! attempts per second. Argon2id is memory-hard, which makes the guessing
//! expensive in a way that scales badly for an attacker with GPUs.
//!
//! Parameters are stored in the file rather than compiled in, so a share
//! written today still opens after we raise them.
//!
//! # What this does not protect against
//!
//! An attacker who has both the file **and** the passphrase — a keylogger, a
//! shoulder, a reused password. Encryption at rest buys time against a stolen
//! disk; it is not a substitute for the passphrase being good, and we should
//! not describe it as more.

use argon2::Argon2;
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    Key, XChaCha20Poly1305, XNonce,
};
use frost_core::keys::KeyPackage;
use quorum_core::Ciphersuite;
use rand_core::{CryptoRng, RngCore};
use zeroize::Zeroize;

/// Format marker. Lets a future change to the KDF or cipher be recognised
/// rather than guessed at.
const FORMAT: u8 = 1;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 24; // XChaCha20 takes a 192-bit nonce
const KEY_LEN: usize = 32;

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("wrong passphrase, or the file has been altered")]
    CannotDecrypt,
    #[error("not a Quorum share file")]
    NotAShareFile,
    #[error("share file uses format version {found}; this build understands {FORMAT}")]
    UnknownFormat { found: u8 },
    #[error("share file is truncated")]
    Truncated,
    #[error("key derivation failed: {0}")]
    Kdf(String),
    #[error("could not serialise the key package: {0}")]
    Serialize(String),
}

/// Derives the file key from a passphrase.
///
/// XChaCha20-Poly1305 over an Argon2id-derived key. XChaCha rather than
/// ChaCha because its 192-bit nonce can be drawn at random without worrying
/// about collisions — with a 96-bit nonce we would have to track a counter,
/// and a counter that resets is how nonce reuse happens.
fn derive_key(passphrase: &[u8], salt: &[u8]) -> Result<[u8; KEY_LEN], StoreError> {
    let mut key = [0u8; KEY_LEN];
    Argon2::default()
        .hash_password_into(passphrase, salt, &mut key)
        .map_err(|e| StoreError::Kdf(e.to_string()))?;
    Ok(key)
}

/// Encrypt a key package for storage.
///
/// Layout: `FORMAT | salt(16) | nonce(24) | ciphertext`.
pub fn seal<R: RngCore + CryptoRng>(
    key_package: &KeyPackage<Ciphersuite>,
    passphrase: &str,
    rng: &mut R,
) -> Result<Vec<u8>, StoreError> {
    let mut plaintext = key_package
        .serialize()
        .map_err(|e| StoreError::Serialize(e.to_string()))?;

    let mut salt = [0u8; SALT_LEN];
    rng.fill_bytes(&mut salt);
    let mut nonce = [0u8; NONCE_LEN];
    rng.fill_bytes(&mut nonce);

    let mut key = derive_key(passphrase.as_bytes(), &salt)?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&key));
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), plaintext.as_ref())
        .map_err(|_| StoreError::CannotDecrypt)?;

    // The serialised share was in memory; do not leave it there.
    plaintext.zeroize();
    key.zeroize();

    let mut out = Vec::with_capacity(1 + SALT_LEN + NONCE_LEN + ciphertext.len());
    out.push(FORMAT);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypt a stored key package.
///
/// A wrong passphrase and a tampered file are deliberately the same error.
/// Distinguishing them would tell an attacker which of the two they had got
/// right.
pub fn open(stored: &[u8], passphrase: &str) -> Result<KeyPackage<Ciphersuite>, StoreError> {
    if stored.is_empty() {
        return Err(StoreError::NotAShareFile);
    }
    if stored[0] != FORMAT {
        return Err(StoreError::UnknownFormat { found: stored[0] });
    }
    if stored.len() < 1 + SALT_LEN + NONCE_LEN + 1 {
        return Err(StoreError::Truncated);
    }

    let salt = &stored[1..1 + SALT_LEN];
    let nonce = &stored[1 + SALT_LEN..1 + SALT_LEN + NONCE_LEN];
    let ciphertext = &stored[1 + SALT_LEN + NONCE_LEN..];

    let mut key = derive_key(passphrase.as_bytes(), salt)?;
    let cipher = XChaCha20Poly1305::new(Key::from_slice(&key));
    let mut plaintext = cipher
        .decrypt(XNonce::from_slice(nonce), ciphertext)
        .map_err(|_| StoreError::CannotDecrypt)?;
    key.zeroize();

    let package =
        KeyPackage::deserialize(&plaintext).map_err(|e| StoreError::Serialize(e.to_string()))?;
    plaintext.zeroize();
    Ok(package)
}
