//! The key ceremony, over a relay, with nothing shared but the relay.
//!
//! # What this proves, and what it does not
//!
//! These three participants are three tasks in one process, so this is
//! **not** the process-isolation proof. That is
//! `./scripts/three-party-ceremony.sh`, which runs three OS processes
//! against a real `frostd`.
//!
//! What this covers is everything that can regress silently: the
//! choreography, the per-recipient sealing, the ordering rules, the
//! confirmation round, and — in [`the_relay_carries_only_ciphertext`] — the
//! claim that the relay operator learns nothing. It runs in CI, where there
//! is no frostd.
//!
//! The relay below implements frostd's wire protocol rather than importing
//! it. That is deliberate: `frost-client` is unpublished and pinned to
//! frost-core 2.2.0, so the real check of our wire types is the ignored
//! `quorum-core --test frostd_client` and the demo script, both of which run
//! against the real server.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::post;
use axum::{Json, Router};
use quorum_core::dkg::VaultIdentifier;
use quorum_core::transport::{FrostdClient, Identity, PeerPublicKey};
use quorum_signer::ceremony::{self, CeremonyError, Member, Roster, SeedRole};
use serde_json::{json, Value};

// ── A relay that speaks frostd, trusts nobody, and remembers everything ──

#[derive(Default)]
struct Relay {
    /// Bearer token → the pubkey that logged in with it.
    tokens: HashMap<String, String>,
    challenges: Vec<String>,
    /// session id → (coordinator, members, queues)
    sessions: HashMap<String, Session>,
    /// Every payload the relay ever carried. The confidentiality assertion
    /// reads this: if a round-2 package is in here in the clear, the whole
    /// design is decoration.
    carried: Vec<Vec<u8>>,
}

#[derive(Default)]
struct Session {
    coordinator: String,
    pubkeys: Vec<String>,
    queues: HashMap<String, Vec<(String, String)>>,
}

type Shared = Arc<Mutex<Relay>>;

fn caller(headers: &HeaderMap, relay: &Relay) -> String {
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or_default();
    relay
        .tokens
        .get(token)
        .cloned()
        .unwrap_or_else(|| panic!("a call arrived without a valid token"))
}

async fn spawn_relay() -> (String, Shared) {
    let state: Shared = Arc::new(Mutex::new(Relay::default()));

    let app = Router::new()
        .route(
            "/challenge",
            post(|State(s): State<Shared>| async move {
                let c = uuid::Uuid::new_v4().to_string();
                s.lock().unwrap().challenges.push(c.clone());
                Json(json!({ "challenge": c }))
            }),
        )
        .route(
            "/login",
            post(
                |State(s): State<Shared>, Json(body): Json<Value>| async move {
                    // The real frostd verifies an XEdDSA signature over the
                    // challenge. We do not: this relay exists to test our
                    // choreography, and pretending to authenticate would only
                    // test our own signature code against itself. The real
                    // check runs in quorum-core's frostd_client test.
                    let pubkey = body["pubkey"].as_str().expect("pubkey").to_string();
                    let token = uuid::Uuid::new_v4().to_string();
                    s.lock().unwrap().tokens.insert(token.clone(), pubkey);
                    Json(json!({ "access_token": token }))
                },
            ),
        )
        .route(
            "/create_new_session",
            post(
                |State(s): State<Shared>, headers: HeaderMap, Json(body): Json<Value>| async move {
                    let mut relay = s.lock().unwrap();
                    let me = caller(&headers, &relay);
                    let pubkeys: Vec<String> = body["pubkeys"]
                        .as_array()
                        .expect("pubkeys")
                        .iter()
                        .map(|v| v.as_str().expect("hex").to_string())
                        .collect();
                    let id = uuid::Uuid::new_v4().to_string();
                    relay.sessions.insert(
                        id.clone(),
                        Session {
                            coordinator: me,
                            pubkeys,
                            queues: HashMap::new(),
                        },
                    );
                    Json(json!({ "session_id": id }))
                },
            ),
        )
        .route(
            "/list_sessions",
            post(|State(s): State<Shared>, headers: HeaderMap| async move {
                let relay = s.lock().unwrap();
                let me = caller(&headers, &relay);
                let ids: Vec<&String> = relay
                    .sessions
                    .iter()
                    .filter(|(_, sess)| sess.pubkeys.contains(&me) || sess.coordinator == me)
                    .map(|(id, _)| id)
                    .collect();
                Json(json!({ "session_ids": ids }))
            }),
        )
        .route(
            "/send",
            post(
                |State(s): State<Shared>, headers: HeaderMap, Json(body): Json<Value>| async move {
                    let mut relay = s.lock().unwrap();
                    let me = caller(&headers, &relay);
                    let id = body["session_id"].as_str().expect("session").to_string();
                    let msg = body["msg"].as_str().expect("msg").to_string();
                    relay.carried.push(hex::decode(&msg).expect("hex payload"));

                    let recipients: Vec<String> = body["recipients"]
                        .as_array()
                        .expect("recipients")
                        .iter()
                        .map(|v| v.as_str().expect("hex").to_string())
                        .collect();

                    let session = relay.sessions.get_mut(&id).expect("session exists");
                    // frostd's own check, reproduced because getting it
                    // wrong is exactly the bug this test should catch: a
                    // coordinator left out of `pubkeys` is unreachable.
                    for r in &recipients {
                        assert!(
                            session.pubkeys.contains(r),
                            "recipient {r} is not in the session — frostd would answer NotInSession"
                        );
                        session
                            .queues
                            .entry(r.clone())
                            .or_default()
                            .push((me.clone(), msg.clone()));
                    }
                    Json(json!(null))
                },
            ),
        )
        .route(
            "/receive",
            post(
                |State(s): State<Shared>, headers: HeaderMap, Json(body): Json<Value>| async move {
                    let mut relay = s.lock().unwrap();
                    let me = caller(&headers, &relay);
                    let id = body["session_id"].as_str().expect("session").to_string();
                    let session = relay.sessions.get_mut(&id).expect("session exists");
                    let msgs: Vec<Value> = session
                        .queues
                        .entry(me)
                        .or_default()
                        .drain(..)
                        .map(|(sender, msg)| json!({ "sender": sender, "msg": msg }))
                        .collect();
                    Json(json!({ "msgs": msgs }))
                },
            ),
        )
        .route("/close_session", post(|| async { Json(json!(null)) }))
        .route("/logout", post(|| async { Json(json!(null)) }))
        .with_state(state.clone());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move {
        axum::serve(listener, app).await.expect("serve");
    });

    (format!("http://{addr}"), state)
}

// ── Fixtures ─────────────────────────────────────────────────

fn roster_of(identities: &[(&str, &Identity)]) -> Roster {
    Roster {
        threshold: 2,
        participants: identities
            .iter()
            .enumerate()
            .map(|(i, (label, identity))| Member {
                label: (*label).to_string(),
                identifier: hex::encode(
                    VaultIdentifier::try_from(i as u16 + 1)
                        .expect("identifier")
                        .serialize(),
                ),
                pubkey: identity.public_key().to_hex(),
            })
            .collect(),
    }
}

/// Log everyone in and open one session containing all of them.
///
/// Note that the creator is in `pubkeys` too. frostd keeps the session
/// coordinator separate from the participant list, so a creator who leaves
/// themselves out becomes unaddressable and the ceremony times out with no
/// indication why.
async fn session_for(
    url: &str,
    identities: &[&Identity],
) -> (Vec<FrostdClient>, quorum_core::transport::SessionId) {
    let mut clients = Vec::new();
    for identity in identities {
        let mut c = FrostdClient::new(url);
        c.login(identity, rand::thread_rng()).await.expect("login");
        clients.push(c);
    }
    let everyone: Vec<PeerPublicKey> = identities.iter().map(|i| i.public_key().clone()).collect();
    let session = clients[0]
        .create_session(&everyone, 1)
        .await
        .expect("create session");
    (clients, session)
}

const TIMEOUT: Duration = Duration::from_secs(20);

// ── Tests ────────────────────────────────────────────────────

/// Three participants, one relay, three shares that were never together.
#[tokio::test]
async fn three_participants_each_end_up_with_exactly_one_share() {
    let (url, _relay) = spawn_relay().await;
    let alice = Identity::generate().expect("keypair");
    let bob = Identity::generate().expect("keypair");
    let carol = Identity::generate().expect("keypair");
    let roster = roster_of(&[("Alice", &alice), ("Bob", &bob), ("Carol", &carol)]);
    let (clients, session) = session_for(&url, &[&alice, &bob, &carol]).await;

    let outcomes = futures_join3(
        ceremony::run(
            &alice,
            &roster,
            &clients[0],
            session,
            SeedRole::Contribute,
            TIMEOUT,
            rand::thread_rng(),
        ),
        ceremony::run(
            &bob,
            &roster,
            &clients[1],
            session,
            SeedRole::Await,
            TIMEOUT,
            rand::thread_rng(),
        ),
        ceremony::run(
            &carol,
            &roster,
            &clients[2],
            session,
            SeedRole::Await,
            TIMEOUT,
            rand::thread_rng(),
        ),
    )
    .await;

    let (a, b, c) = (
        outcomes.0.expect("alice"),
        outcomes.1.expect("bob"),
        outcomes.2.expect("carol"),
    );

    // One vault, agreed without anyone being told to agree.
    assert_eq!(a.address, b.address);
    assert_eq!(b.address, c.address);
    assert_eq!(a.seed.as_bytes(), b.seed.as_bytes());
    assert_eq!(b.seed.as_bytes(), c.seed.as_bytes());

    // Three different shares of it. If any two matched, the "threshold"
    // would be theatre.
    let ids = [
        a.key_package.identifier(),
        b.key_package.identifier(),
        c.key_package.identifier(),
    ];
    assert_ne!(ids[0], ids[1]);
    assert_ne!(ids[1], ids[2]);
    assert_ne!(ids[0], ids[2]);

    let signing_shares: Vec<Vec<u8>> = [&a, &b, &c]
        .iter()
        .map(|o| o.key_package.signing_share().serialize())
        .collect();
    assert_ne!(signing_shares[0], signing_shares[1]);
    assert_ne!(signing_shares[1], signing_shares[2]);
}

/// The relay operator learns nothing worth having.
///
/// This is the load-bearing assertion behind "the relay is untrusted". If
/// it fails, a round-2 package — secret share material for one named
/// recipient — went past the relay in the clear.
#[tokio::test]
async fn the_relay_carries_only_ciphertext() {
    let (url, relay) = spawn_relay().await;
    let alice = Identity::generate().expect("keypair");
    let bob = Identity::generate().expect("keypair");
    let carol = Identity::generate().expect("keypair");
    let roster = roster_of(&[("Alice", &alice), ("Bob", &bob), ("Carol", &carol)]);
    let (clients, session) = session_for(&url, &[&alice, &bob, &carol]).await;

    let outcomes = futures_join3(
        ceremony::run(
            &alice,
            &roster,
            &clients[0],
            session,
            SeedRole::Contribute,
            TIMEOUT,
            rand::thread_rng(),
        ),
        ceremony::run(
            &bob,
            &roster,
            &clients[1],
            session,
            SeedRole::Await,
            TIMEOUT,
            rand::thread_rng(),
        ),
        ceremony::run(
            &carol,
            &roster,
            &clients[2],
            session,
            SeedRole::Await,
            TIMEOUT,
            rand::thread_rng(),
        ),
    )
    .await;
    let seed_hex = hex::encode(outcomes.0.expect("alice").seed.as_bytes());

    let carried = &relay.lock().unwrap().carried;
    assert!(
        carried.len() >= 6,
        "expected at least two rounds of traffic, saw {}",
        carried.len()
    );

    for payload in carried {
        // Our envelopes are JSON tagged with "step". None of that should
        // survive to the relay.
        assert!(
            serde_json::from_slice::<Value>(payload).is_err(),
            "the relay received parseable JSON — a payload went out unsealed"
        );
        let as_text = String::from_utf8_lossy(payload);
        assert!(
            !as_text.contains("step"),
            "envelope tag visible to the relay"
        );
        assert!(
            !as_text.contains(&seed_hex),
            "the vault seed crossed the relay in the clear"
        );
    }
}

/// A seed contributor who tells each peer a different story is caught, and
/// nobody writes a share.
///
/// FROST itself raises no objection: all three hold valid shares of the
/// same group key. Only `nk` and `rivk` differ, so the addresses diverge —
/// three vaults wearing one name. This exact failure, in a single-process
/// form, stranded testnet funds on 22 September.
#[tokio::test]
async fn an_equivocated_seed_aborts_before_anything_is_written() {
    let (url, _relay) = spawn_relay().await;
    let alice = Identity::generate().expect("keypair");
    let bob = Identity::generate().expect("keypair");
    let carol = Identity::generate().expect("keypair");
    let roster = roster_of(&[("Alice", &alice), ("Bob", &bob), ("Carol", &carol)]);
    let (clients, session) = session_for(&url, &[&alice, &bob, &carol]).await;

    let outcomes = futures_join3(
        ceremony::run(
            &alice,
            &roster,
            &clients[0],
            session,
            SeedRole::ContributeInconsistently,
            TIMEOUT,
            rand::thread_rng(),
        ),
        ceremony::run(
            &bob,
            &roster,
            &clients[1],
            session,
            SeedRole::Await,
            TIMEOUT,
            rand::thread_rng(),
        ),
        ceremony::run(
            &carol,
            &roster,
            &clients[2],
            session,
            SeedRole::Await,
            TIMEOUT,
            rand::thread_rng(),
        ),
    )
    .await;

    for (who, outcome) in [
        ("Alice", outcomes.0),
        ("Bob", outcomes.1),
        ("Carol", outcomes.2),
    ] {
        match outcome {
            Err(CeremonyError::Disagreement {
                ours_key,
                theirs_key,
                ours_addr,
                theirs_addr,
                ..
            }) => {
                // The tell: FROST succeeded. Only the address diverged.
                assert_eq!(
                    ours_key, theirs_key,
                    "{who}: the group key should match — it is the seed that differs"
                );
                assert_ne!(ours_addr, theirs_addr, "{who}: addresses should diverge");
            }
            Err(other) => panic!("{who} failed for the wrong reason: {other}"),
            Ok(_) => panic!("{who} completed a ceremony that disagreed with itself"),
        }
    }
}

/// A participant who is on the relay but not in the roster is not a
/// participant, and finding one is fatal rather than ignorable.
#[tokio::test]
async fn a_sender_outside_the_roster_aborts_the_ceremony() {
    let (url, _relay) = spawn_relay().await;
    let alice = Identity::generate().expect("keypair");
    let bob = Identity::generate().expect("keypair");
    let carol = Identity::generate().expect("keypair");
    let mallory = Identity::generate().expect("keypair");

    // Mallory is in the frostd session but not in the roster: the relay
    // operator added her, or the session id leaked. Either way the roster
    // is the authority on who is in the vault.
    let roster = roster_of(&[("Alice", &alice), ("Bob", &bob), ("Carol", &carol)]);
    let (clients, session) = session_for(&url, &[&alice, &bob, &carol, &mallory]).await;

    let mut mallory_client = FrostdClient::new(&url);
    mallory_client
        .login(&mallory, rand::thread_rng())
        .await
        .expect("login");
    mallory_client
        .send(
            session,
            std::slice::from_ref(alice.public_key()),
            b"anything at all",
        )
        .await
        .expect("relay accepts it — that is the relay's problem, not ours");

    let result = ceremony::run(
        &alice,
        &roster,
        &clients[0],
        session,
        SeedRole::Contribute,
        Duration::from_secs(3),
        rand::thread_rng(),
    )
    .await;

    match result {
        Err(CeremonyError::Stranger(key)) => {
            assert_eq!(key, mallory.public_key().to_hex());
        }
        Err(other) => panic!("aborted for the wrong reason: {other}"),
        Ok(_) => panic!("a ceremony completed with an unknown participant in the session"),
    }
}

/// `tokio::join!` without pulling in `futures`.
async fn futures_join3<A, B, C>(a: A, b: B, c: C) -> (A::Output, B::Output, C::Output)
where
    A: std::future::Future,
    B: std::future::Future,
    C: std::future::Future,
{
    tokio::join!(a, b, c)
}
