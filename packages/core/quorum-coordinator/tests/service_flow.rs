//! The coordinator service, driven the way the web app and a signer would.
//!
//! In-process — axum's `Router` is called directly rather than over a socket,
//! which keeps the test fast and still exercises every handler, extractor and
//! serialisation boundary the real client hits.
//!
//! Covers P3-A1 (the service exists and speaks the contract), P3-A2 (a bad
//! share is attributed) and P3-A3 (a signer who never answers is marked, and
//! does not break anything).

use std::collections::BTreeMap;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use frost_core::keys::{self, IdentifierList, KeyPackage};
use quorum_coordinator::routes::router;
use quorum_coordinator::service::AppState;
use quorum_core::Ciphersuite;
use quorum_signer::SigningSession;
use serde_json::{json, Value};
use tower::ServiceExt;

/// A PCZT captured from a real testnet transaction — the one that became
/// Gate B. Using a real artifact rather than a synthetic one means the test
/// exercises the actual bundle shape a wallet produces.
const PCZT_FIXTURE: &str = include_str!("fixtures/unsigned_pczt.hex");

struct Fixture {
    vault_id: String,
    key_packages: BTreeMap<String, KeyPackage<Ciphersuite>>,
}

async fn call(app: &axum::Router, path: &str, body: Value) -> (StatusCode, Value) {
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(path)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("request"),
        )
        .await
        .expect("response");
    let status = res.status();
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .expect("body");
    let value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, value)
}

async fn fixture() -> (axum::Router, Fixture) {
    let mut rng = rand::thread_rng();
    let (shares, pubkeys) =
        keys::generate_with_dealer::<Ciphersuite, _>(3, 2, IdentifierList::Default, &mut rng)
            .expect("dealer keygen");

    let key_packages: BTreeMap<String, KeyPackage<Ciphersuite>> = shares
        .into_iter()
        .map(|(id, s)| {
            (
                hex::encode(id.serialize()),
                KeyPackage::try_from(s).expect("key package"),
            )
        })
        .collect();

    let app = router(AppState::new());

    let names = ["Alice", "Bob", "Carol"];
    let participants: Vec<Value> = key_packages
        .keys()
        .zip(names)
        .map(|(id, label)| json!({ "id": id, "label": label }))
        .collect();

    let (status, body) = call(
        &app,
        "/coordinator/vault/register",
        json!({
            "label": "Foundation Treasury",
            "threshold": 2,
            "address": "utest1example",
            "publicKeyPackage": serde_json::to_value(&pubkeys).expect("serialise"),
            "participants": participants,
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "register vault: {body}");

    let vault_id = body["vaultId"].as_str().expect("vaultId").to_string();
    (
        app,
        Fixture {
            vault_id,
            key_packages,
        },
    )
}

async fn open_request(app: &axum::Router, vault_id: &str, deadline: u64) -> String {
    let (status, body) = call(
        app,
        "/coordinator/approval/submit",
        json!({
            "vaultId": vault_id,
            "recipientAddress": "utest1recipient",
            "amountZatoshi": "1000000",
            "pcztHex": PCZT_FIXTURE.trim(),
            "signerDeadlineSecs": deadline,
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "submit approval: {body}");
    assert_eq!(body["status"], "PENDING");
    body["id"].as_str().expect("id").to_string()
}

#[tokio::test]
async fn the_browser_surface_cannot_sign() {
    // The contract split exists so this is structurally true, not a
    // convention. If a /coordinator route ever grows the ability to produce a
    // signature, this test should start failing.
    let (app, _f) = fixture().await;
    for path in ["/coordinator/sign", "/coordinator/approval/sign"] {
        let (status, _) = call(&app, path, json!({})).await;
        assert_eq!(
            status,
            StatusCode::NOT_FOUND,
            "{path} must not exist on the browser surface"
        );
    }
}

#[tokio::test]
async fn two_of_three_sign_through_the_service() {
    let (app, f) = fixture().await;
    let approval = open_request(&app, &f.vault_id, 300).await;
    let mut rng = rand::thread_rng();

    // Round 1 — two signers commit.
    let signers: Vec<String> = f.key_packages.keys().take(2).cloned().collect();
    let mut sessions = BTreeMap::new();
    for id in &signers {
        let kp = &f.key_packages[id];
        // One action in the fixture; ask the service rather than assuming.
        let session = SigningSession::begin(kp, 1, &mut rng).expect("round 1");
        let hexes: Vec<String> = session
            .commitments()
            .iter()
            .map(|c| hex::encode(c.serialize().expect("serialise")))
            .collect();
        let (status, body) = call(
            &app,
            "/signer/commit",
            json!({ "approvalId": approval, "participantId": id, "commitmentsHex": hexes }),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "commit: {body}");
        sessions.insert(id.clone(), session);
    }

    // Round 2 becomes available only once threshold commitments are in.
    let (status, packages) = call(
        &app,
        "/signer/packages",
        json!({ "approvalId": approval, "participantId": signers[0], "commitmentsHex": [] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "packages: {packages}");
    assert_eq!(packages["actions"].as_array().expect("actions").len(), 1);

    let randomizers: Vec<[u8; 32]> = packages["actions"]
        .as_array()
        .expect("actions")
        .iter()
        .map(|a| {
            hex::decode(a["alphaHex"].as_str().expect("alphaHex"))
                .expect("hex")
                .try_into()
                .expect("32 bytes")
        })
        .collect();
    let signing_packages: Vec<_> = packages["signingPackagesHex"]
        .as_array()
        .expect("packages")
        .iter()
        .map(|h| {
            frost_core::SigningPackage::deserialize(
                &hex::decode(h.as_str().expect("hex")).expect("hex"),
            )
            .expect("signing package")
        })
        .collect();

    for id in &signers {
        let session = sessions.remove(id).expect("session");
        let shares = session
            .sign(&f.key_packages[id], &signing_packages, &randomizers)
            .expect("round 2");
        let hexes: Vec<String> = shares.iter().map(|s| hex::encode(s.serialize())).collect();
        let (status, body) = call(
            &app,
            "/signer/shares",
            json!({ "approvalId": approval, "participantId": id, "sharesHex": hexes }),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "shares: {body}");
    }

    let (_, state) = call(
        &app,
        "/coordinator/approval/status",
        json!({ "approvalId": approval }),
    )
    .await;
    assert_eq!(
        state["status"], "APPROVED",
        "round should complete: {state}"
    );
    assert_eq!(state["signaturesCollected"], 2);
}

#[tokio::test]
async fn a_bad_share_is_attributed_by_name() {
    // Feature F4, end to end through the service. A treasurer needs a name,
    // not "signing failed" — and needs to know nothing was spent.
    let (app, f) = fixture().await;
    let approval = open_request(&app, &f.vault_id, 300).await;
    let mut rng = rand::thread_rng();

    let signers: Vec<String> = f.key_packages.keys().take(2).cloned().collect();
    let mut sessions = BTreeMap::new();
    for id in &signers {
        let session = SigningSession::begin(&f.key_packages[id], 1, &mut rng).expect("round 1");
        let hexes: Vec<String> = session
            .commitments()
            .iter()
            .map(|c| hex::encode(c.serialize().expect("serialise")))
            .collect();
        call(
            &app,
            "/signer/commit",
            json!({ "approvalId": approval, "participantId": id, "commitmentsHex": hexes }),
        )
        .await;
        sessions.insert(id.clone(), session);
    }

    let (_, packages) = call(
        &app,
        "/signer/packages",
        json!({ "approvalId": approval, "participantId": signers[0], "commitmentsHex": [] }),
    )
    .await;
    let randomizers: Vec<[u8; 32]> = packages["actions"]
        .as_array()
        .expect("actions")
        .iter()
        .map(|a| {
            hex::decode(a["alphaHex"].as_str().expect("alphaHex"))
                .expect("hex")
                .try_into()
                .expect("32")
        })
        .collect();
    let signing_packages: Vec<_> = packages["signingPackagesHex"]
        .as_array()
        .expect("packages")
        .iter()
        .map(|h| {
            frost_core::SigningPackage::deserialize(
                &hex::decode(h.as_str().expect("hex")).expect("hex"),
            )
            .expect("package")
        })
        .collect();

    // Both sign honestly, then the first submits the second's share —
    // well-formed, but not matching the commitment they made in round 1.
    let mut produced = BTreeMap::new();
    for id in &signers {
        let s = sessions.remove(id).expect("session");
        produced.insert(
            id.clone(),
            s.sign(&f.key_packages[id], &signing_packages, &randomizers)
                .expect("sign"),
        );
    }
    let swapped = produced[&signers[1]].clone();

    call(
        &app,
        "/signer/shares",
        json!({
            "approvalId": approval, "participantId": signers[1],
            "sharesHex": produced[&signers[1]].iter().map(|s| hex::encode(s.serialize())).collect::<Vec<_>>(),
        }),
    )
    .await;

    let (status, err) = call(
        &app,
        "/signer/shares",
        json!({
            "approvalId": approval, "participantId": signers[0],
            "sharesHex": swapped.iter().map(|s| hex::encode(s.serialize())).collect::<Vec<_>>(),
        }),
    )
    .await;

    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a bad share must be rejected: {err}"
    );
    assert_eq!(err["code"], "INVALID_SHARE");
    let culprits = err["culprits"].as_array().expect("culprits named");
    assert!(!culprits.is_empty(), "the signer must be named");
    let message = err["message"].as_str().expect("message");
    assert!(
        message.contains("no funds moved"),
        "the treasurer must be told nothing was spent: {message}"
    );

    let (_, state) = call(
        &app,
        "/coordinator/approval/status",
        json!({ "approvalId": approval }),
    )
    .await;
    assert_eq!(state["status"], "REJECTED");
    assert!(
        state["events"]
            .as_array()
            .expect("events")
            .iter()
            .any(|e| e["culpritDetected"] == true),
        "the event log must record the attribution"
    );
}

#[tokio::test]
async fn a_signer_who_never_answers_is_marked_not_blamed() {
    // The commonest real failure of shared control is someone on a plane.
    // It must read differently from a bad share, and it must not abort the
    // round.
    let (app, f) = fixture().await;
    let approval = open_request(&app, &f.vault_id, 0).await; // deadline already passed

    let (_, state) = call(
        &app,
        "/coordinator/approval/status",
        json!({ "approvalId": approval }),
    )
    .await;

    let statuses: Vec<&str> = state["signerStatuses"]
        .as_array()
        .expect("signers")
        .iter()
        .map(|s| s["status"].as_str().expect("status"))
        .collect();
    assert!(
        statuses.iter().all(|s| *s == "TIMEOUT"),
        "everyone who did not answer should be TIMEOUT, got {statuses:?}"
    );

    let events = state["events"].as_array().expect("events");
    assert!(
        events.iter().all(|e| e["culpritDetected"] == false),
        "a timeout is not misbehaviour and must not be recorded as one"
    );
    let detail = events[0]["errorDetails"].as_str().expect("details");
    assert!(
        detail.contains("This is normal"),
        "the message should reassure, not alarm: {detail}"
    );
    assert_eq!(
        state["status"], "PENDING",
        "a timeout does not kill the request"
    );
}
