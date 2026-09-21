//! End-to-end encryption between participants, over an untrusted relay.
//!
//! `frostd` is a relay, not a trusted party. It sees who talks to whom and can
//! refuse to pass messages along — a liveness attack we accept — but it must
//! never read round-2 DKG packages, because those carry secret share material.
//! This module is what makes that true.
//!
//! # The pattern, and why `_K_`
//!
//! `Noise_K_25519_ChaChaPoly_BLAKE2s`. The `K` means **both parties' static
//! public keys are known before the handshake begins**. No key exchange
//! happens over the wire, so there is no moment for the relay to substitute a
//! key: a man-in-the-middle would have to already possess a participant's
//! private key.
//!
//! That pushes the entire trust question back to how participants learned each
//! other's public keys in the first place. **That out-of-band exchange is the
//! real attack surface**, and it is why contact verification has to be a step
//! the user performs deliberately rather than setup chrome they click past.
//!
//! # Two sessions per peer
//!
//! Each peer gets an initiator session for sending and a responder session for
//! receiving. Both sides do the same, so A's initiator pairs with B's
//! responder and vice versa — symmetric, with no role negotiation to get
//! wrong.

use std::collections::HashMap;

use snow::{HandshakeState, TransportState};

use super::{PeerPublicKey, PrivateKey};

/// Largest frame we will encrypt or accept. Matches frostd's own limit.
pub const MAX_MSG_SIZE: usize = 65535;

#[derive(Debug, thiserror::Error)]
pub enum CipherError {
    #[error("noise error: {0}")]
    Noise(#[from] snow::Error),
    #[error("no session for peer {0}; they were not part of this ceremony")]
    UnknownPeer(String),
    #[error("message of {size} bytes exceeds the {MAX_MSG_SIZE} byte limit")]
    TooLarge { size: usize },
}

/// One direction of one peer relationship.
///
/// `snow` splits handshake and transport into different types, and the
/// transition happens on the first message. This holds whichever is current.
struct Session {
    handshake: Option<HandshakeState>,
    transport: Option<TransportState>,
}

impl Session {
    fn new(handshake: HandshakeState) -> Self {
        Self {
            handshake: Some(handshake),
            transport: None,
        }
    }

    /// Encrypts. The first call also completes the handshake, because `Noise_K`
    /// is a one-message pattern.
    fn write(&mut self, payload: &[u8], out: &mut [u8]) -> Result<usize, snow::Error> {
        if let Some(hs) = &mut self.handshake {
            let written = hs.write_message(payload, out);
            if hs.is_handshake_finished() {
                let hs = self.handshake.take().expect("just checked");
                self.transport = Some(hs.into_transport_mode()?);
            }
            written
        } else {
            self.transport
                .as_mut()
                .expect("one of the two is always set")
                .write_message(payload, out)
        }
    }

    /// Decrypts. Mirrors `write`.
    fn read(&mut self, message: &[u8], out: &mut [u8]) -> Result<usize, snow::Error> {
        if let Some(hs) = &mut self.handshake {
            let read = hs.read_message(message, out);
            if hs.is_handshake_finished() {
                let hs = self.handshake.take().expect("just checked");
                self.transport = Some(hs.into_transport_mode()?);
            }
            read
        } else {
            self.transport
                .as_mut()
                .expect("one of the two is always set")
                .read_message(message, out)
        }
    }
}

/// Encrypts to, and decrypts from, a fixed set of peers.
pub struct Cipher {
    send: HashMap<PeerPublicKey, Session>,
    recv: HashMap<PeerPublicKey, Session>,
}

impl Cipher {
    const PATTERN: &'static str = "Noise_K_25519_ChaChaPoly_BLAKE2s";

    /// Build sessions for every peer in the ceremony.
    ///
    /// `peers` must be exactly the other participants — a peer missing here
    /// cannot be talked to, and a peer that should not be here can read
    /// everything sent to them.
    pub fn new(private_key: &PrivateKey, peers: &[PeerPublicKey]) -> Result<Self, CipherError> {
        let mut send = HashMap::new();
        let mut recv = HashMap::new();

        for peer in peers {
            let initiator = snow::Builder::new(Self::PATTERN.parse().expect("valid pattern"))
                .local_private_key(private_key.as_bytes())
                .remote_public_key(peer.as_bytes())
                .build_initiator()?;
            let responder = snow::Builder::new(Self::PATTERN.parse().expect("valid pattern"))
                .local_private_key(private_key.as_bytes())
                .remote_public_key(peer.as_bytes())
                .build_responder()?;
            send.insert(peer.clone(), Session::new(initiator));
            recv.insert(peer.clone(), Session::new(responder));
        }

        Ok(Self { send, recv })
    }

    /// Encrypt a payload for one peer.
    pub fn encrypt(
        &mut self,
        peer: &PeerPublicKey,
        payload: &[u8],
    ) -> Result<Vec<u8>, CipherError> {
        if payload.len() > MAX_MSG_SIZE {
            return Err(CipherError::TooLarge {
                size: payload.len(),
            });
        }
        let session = self
            .send
            .get_mut(peer)
            .ok_or_else(|| CipherError::UnknownPeer(peer.to_hex()))?;

        let mut buf = vec![0u8; MAX_MSG_SIZE];
        let n = session.write(payload, &mut buf)?;
        buf.truncate(n);
        Ok(buf)
    }

    /// Decrypt a payload from one peer.
    ///
    /// Failure here is not noise on the line: `Noise_K` is authenticated, so a
    /// message that does not decrypt was not written by the peer whose key we
    /// hold. Treat it as tampering, not as a retry.
    pub fn decrypt(
        &mut self,
        peer: &PeerPublicKey,
        message: &[u8],
    ) -> Result<Vec<u8>, CipherError> {
        let session = self
            .recv
            .get_mut(peer)
            .ok_or_else(|| CipherError::UnknownPeer(peer.to_hex()))?;

        let mut buf = vec![0u8; MAX_MSG_SIZE];
        let n = session.read(message, &mut buf)?;
        buf.truncate(n);
        Ok(buf)
    }
}
