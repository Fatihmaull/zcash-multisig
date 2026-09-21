//! Does the Noise layer actually keep the relay out?
//!
//! No network here — two `Cipher`s talk to each other directly, which is what
//! the relay reduces to once you remove the HTTP.

use quorum_core::transport::{Cipher, Identity, PeerPublicKey};

/// Two participants who know each other's public keys, as `Noise_K` requires.
fn pair() -> (Identity, Identity, Cipher, Cipher) {
    let alice = Identity::generate().expect("keypair");
    let bob = Identity::generate().expect("keypair");

    let alice_cipher =
        Cipher::new(alice.private_key(), &[bob.public_key().clone()]).expect("cipher");
    let bob_cipher = Cipher::new(bob.private_key(), &[alice.public_key().clone()]).expect("cipher");

    (alice, bob, alice_cipher, bob_cipher)
}

#[test]
fn a_message_survives_the_round_trip() {
    let (alice, bob, mut ac, mut bc) = pair();

    let plaintext = b"round 2 package for one specific recipient";
    let sealed = ac.encrypt(bob.public_key(), plaintext).expect("encrypt");

    assert_ne!(
        sealed.as_slice(),
        plaintext.as_slice(),
        "the relay must never see plaintext"
    );

    let opened = bc.decrypt(alice.public_key(), &sealed).expect("decrypt");
    assert_eq!(opened.as_slice(), plaintext.as_slice());
}

#[test]
fn several_messages_survive_in_order() {
    // The first message completes the Noise_K handshake and the session then
    // moves to transport mode. If that transition is mishandled, message two
    // fails while message one looks fine — so one round trip proves nothing.
    let (alice, bob, mut ac, mut bc) = pair();

    for i in 0..5u8 {
        let msg = vec![i; 100 + i as usize];
        let sealed = ac.encrypt(bob.public_key(), &msg).expect("encrypt");
        let opened = bc.decrypt(alice.public_key(), &sealed).expect("decrypt");
        assert_eq!(opened, msg, "message {i} did not survive");
    }
}

#[test]
fn both_directions_work_independently() {
    let (alice, bob, mut ac, mut bc) = pair();

    let a_to_b = ac.encrypt(bob.public_key(), b"from alice").expect("enc");
    let b_to_a = bc.encrypt(alice.public_key(), b"from bob").expect("enc");

    assert_eq!(
        bc.decrypt(alice.public_key(), &a_to_b).expect("dec"),
        b"from alice"
    );
    assert_eq!(
        ac.decrypt(bob.public_key(), &b_to_a).expect("dec"),
        b"from bob"
    );
}

#[test]
fn a_third_party_cannot_read_the_traffic() {
    // The relay's position, exactly: it holds everyone's public keys and sees
    // every byte, and that must not be enough.
    let (_alice, bob, mut ac, _bc) = pair();
    let eve = Identity::generate().expect("keypair");

    let sealed = ac
        .encrypt(bob.public_key(), b"share material")
        .expect("enc");

    let mut eve_cipher =
        Cipher::new(eve.private_key(), &[bob.public_key().clone()]).expect("cipher");
    assert!(
        eve_cipher.decrypt(bob.public_key(), &sealed).is_err(),
        "someone holding only public keys must not be able to decrypt"
    );
}

#[test]
fn tampering_is_detected() {
    // Noise_K is authenticated. A flipped byte must fail loudly rather than
    // yielding garbage a caller might parse — a substituted round-2 package
    // is how an attacker ends up holding a share of the vault.
    let (alice, bob, mut ac, mut bc) = pair();

    let mut sealed = ac.encrypt(bob.public_key(), b"authentic").expect("enc");
    let last = sealed.len() - 1;
    sealed[last] ^= 0x01;

    assert!(
        bc.decrypt(alice.public_key(), &sealed).is_err(),
        "a tampered message must be rejected, not silently accepted"
    );
}

#[test]
fn an_unknown_peer_is_refused() {
    let (_alice, _bob, mut ac, _bc) = pair();
    let stranger = PeerPublicKey::from_bytes([7u8; 32]);
    assert!(ac.encrypt(&stranger, b"hello").is_err());
}

#[test]
fn public_keys_round_trip_through_hex() {
    // They travel as hex in frostd's JSON and get copied between humans
    // during contact exchange — the step Noise_K's security rests on.
    let id = Identity::generate().expect("keypair");
    let hex = id.public_key().to_hex();
    assert_eq!(hex.len(), 64);
    assert_eq!(
        &PeerPublicKey::from_hex(&hex).expect("parse"),
        id.public_key()
    );
    assert!(PeerPublicKey::from_hex("nonsense").is_err());
}
