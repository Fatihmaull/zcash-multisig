//! The frostd client against a real server.
//!
//! **Ignored by default** — CI has no frostd. Run it with a server on
//! `127.0.0.1:2744`:
//!
//! ```sh
//! frostd --no-tls-very-insecure -i 127.0.0.1 -p 2744 &
//! cargo test -p quorum-core --test frostd_client -- --ignored --nocapture
//! ```
//!
//! What this proves that the unit tests cannot: our wire types match what
//! frostd actually accepts. We wrote this client from scratch because
//! `frost-client` is unpublished and pinned to FROST v2, so nothing but a
//! real exchange confirms the JSON shapes and the XEdDSA challenge signature
//! are right.

use quorum_core::transport::{Cipher, FrostdClient, Identity};

const FROSTD: &str = "http://127.0.0.1:2744";

#[tokio::test]
#[ignore = "needs a frostd on 127.0.0.1:2744"]
async fn login_session_and_an_encrypted_round_trip() {
    let alice = Identity::generate().expect("keypair");
    let bob = Identity::generate().expect("keypair");

    let mut alice_client = FrostdClient::new(FROSTD);
    let mut bob_client = FrostdClient::new(FROSTD);

    // ── Login: challenge, XEdDSA signature, token ──
    alice_client
        .login(&alice, rand::thread_rng())
        .await
        .expect("alice login");
    bob_client
        .login(&bob, rand::thread_rng())
        .await
        .expect("bob login");
    assert!(alice_client.is_authenticated() && bob_client.is_authenticated());

    // ── Alice opens a session; she is its coordinator ──
    let session = alice_client
        .create_session(&[bob.public_key().clone()], 1)
        .await
        .expect("create session");

    // Bob finds it without anyone passing an id out of band.
    let bobs_sessions = bob_client.list_sessions().await.expect("list");
    assert!(
        bobs_sessions.contains(&session),
        "bob should see the session he was invited to"
    );

    let info = bob_client.session_info(session).await.expect("info");
    assert_eq!(
        &info.coordinator_pubkey,
        alice.public_key(),
        "bob must see alice as coordinator"
    );

    // ── An encrypted message, coordinator to participant ──
    let mut alice_cipher =
        Cipher::new(alice.private_key(), &[bob.public_key().clone()]).expect("cipher");
    let mut bob_cipher =
        Cipher::new(bob.private_key(), &[alice.public_key().clone()]).expect("cipher");

    let secret = b"a round 2 DKG package, for bob's eyes only";
    let sealed = alice_cipher
        .encrypt(bob.public_key(), secret)
        .expect("encrypt");

    alice_client
        .send(session, &[bob.public_key().clone()], &sealed)
        .await
        .expect("send");

    let received = bob_client.receive(session, false).await.expect("receive");
    assert_eq!(received.len(), 1, "bob should have exactly one message");
    assert_eq!(&received[0].sender, alice.public_key());

    // The relay carried ciphertext, not plaintext. This is the property the
    // whole Noise layer exists for.
    assert_ne!(
        received[0].ciphertext.as_slice(),
        secret.as_slice(),
        "frostd must never have seen the plaintext"
    );

    let opened = bob_cipher
        .decrypt(alice.public_key(), &received[0].ciphertext)
        .expect("decrypt");
    assert_eq!(opened.as_slice(), secret.as_slice());

    // ── And back, participant to coordinator ──
    // An empty recipient list addresses the coordinator.
    let reply = bob_cipher
        .encrypt(alice.public_key(), b"round 2 package for alice")
        .expect("encrypt");
    bob_client.send(session, &[], &reply).await.expect("send");

    let at_alice = alice_client.receive(session, true).await.expect("receive");
    assert_eq!(at_alice.len(), 1);
    let opened = alice_cipher
        .decrypt(bob.public_key(), &at_alice[0].ciphertext)
        .expect("decrypt");
    assert_eq!(opened.as_slice(), b"round 2 package for alice".as_slice());

    // ── Cleanup ──
    alice_client
        .close_session(session)
        .await
        .expect("close session");
    alice_client.logout().await.expect("alice logout");
    bob_client.logout().await.expect("bob logout");
}

#[tokio::test]
#[ignore = "needs a frostd on 127.0.0.1:2744"]
async fn calls_without_a_token_are_refused() {
    // The client should not let an unauthenticated call reach the wire, and
    // the server should reject it if one ever does.
    let client = FrostdClient::new(FROSTD);
    assert!(!client.is_authenticated());
    assert!(client.list_sessions().await.is_err());
}
