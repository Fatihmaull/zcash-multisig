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
use ff::PrimeField;
use frost_core::keys::{self, IdentifierList, KeyPackage};
use orchard::keys::SpendValidatingKey;
use pasta_curves::pallas;
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

/// Rewrite the fixture's randomized key so it belongs to `ak`.
///
/// The coordinator refuses a PCZT whose `rk` is not this vault's `ak`
/// randomized by the action's own `alpha` — see
/// `tests/pczt_vault_binding.rs` for why. That check is correct and these
/// tests have to satisfy it, but the fixture was built by a vault whose
/// shares are not in this repository and must not be: a key share belongs on
/// a participant's machine, and a test that needed one committed would be
/// arguing against the product.
///
/// So the transaction is bound to the vault instead of the other way round.
/// `rk` depends only on `ak` and `alpha`, both public, so recomputing it is
/// arithmetic on public data. The result is a structurally valid PCZT that
/// is cryptographically consistent for signing: the sighash is recomputed
/// over the patched bytes, every signer signs that, and aggregation verifies
/// against the vault's real group key.
///
/// **A node would reject the result** — the zk-proof still commits to the
/// original key. That is fine and deliberate: nothing here is broadcast.
/// Broadcasting is proven by `scripts/three-signer-demo.sh` against a vault
/// and a transaction that genuinely belong together.
fn bind_fixture_to(ak: &SpendValidatingKey) -> Vec<u8> {
    let mut bytes = hex::decode(PCZT_FIXTURE.trim()).expect("fixture is hex");
    let spends = quorum_coordinator::spend_keys(&bytes).expect("fixture parses");
    assert_eq!(
        spends.len(),
        1,
        "fixture should have exactly one unsigned spend"
    );

    let alpha = pallas::Scalar::from_repr(spends[0].alpha)
        .into_option()
        .expect("fixture alpha is a scalar");
    let wanted: [u8; 32] = (&ak.randomize(&alpha)).into();

    // Locate the old key by value. Requiring exactly one occurrence is what
    // makes a blind byte replacement safe: if the encoding ever changes shape
    // this fails loudly rather than corrupting some other field.
    let occurrences: Vec<usize> = bytes
        .windows(32)
        .enumerate()
        .filter(|(_, w)| *w == spends[0].rk)
        .map(|(i, _)| i)
        .collect();
    assert_eq!(
        occurrences.len(),
        1,
        "expected rk to appear exactly once in the serialised PCZT, found {}",
        occurrences.len()
    );
    bytes[occurrences[0]..occurrences[0] + 32].copy_from_slice(&wanted);

    // And the patch must have achieved what it claimed.
    let after = quorum_coordinator::spend_keys(&bytes).expect("patched fixture parses");
    assert_eq!(after[0].rk, wanted, "rk patch did not take");
    assert_eq!(after[0].alpha, spends[0].alpha, "alpha must not have moved");
    bytes
}

struct Fixture {
    vault_id: String,
    key_packages: BTreeMap<String, KeyPackage<Ciphersuite>>,
    /// participant id → bearer token, handed out at registration.
    tokens: BTreeMap<String, String>,
    /// The fixture transaction, rebound to this vault. See
    /// [`bind_fixture_to`].
    pczt_hex: String,
}

async fn call(app: &axum::Router, path: &str, body: Value) -> (StatusCode, Value) {
    call_as(app, path, body, None).await
}

/// `token` is the participant's bearer token. Signer routes refuse without
/// one — `participantId` alone is a claim, not a fact.
async fn call_as(
    app: &axum::Router,
    path: &str,
    body: Value,
    token: Option<&str>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json");
    if let Some(t) = token {
        builder = builder.header("authorization", format!("Bearer {t}"));
    }
    let res = app
        .clone()
        .oneshot(builder.body(Body::from(body.to_string())).expect("request"))
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

    let ak = SpendValidatingKey::from_bytes(
        &pubkeys
            .verifying_key()
            .serialize()
            .expect("serialise group key"),
    )
    .expect("a FROST group key is a valid Orchard ak");
    let pczt_hex = hex::encode(bind_fixture_to(&ak));

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
    let tokens: BTreeMap<String, String> = body["participantTokens"]
        .as_array()
        .expect("participantTokens")
        .iter()
        .map(|p| {
            (
                p["participantId"].as_str().expect("id").to_string(),
                p["token"].as_str().expect("token").to_string(),
            )
        })
        .collect();

    (
        app,
        Fixture {
            vault_id,
            key_packages,
            tokens,
            pczt_hex,
        },
    )
}

async fn open_request(app: &axum::Router, f: &Fixture, deadline: u64) -> String {
    let (status, body) = call(
        app,
        "/coordinator/approval/submit",
        json!({
            "vaultId": f.vault_id,
            "recipientAddress": "utest1recipient",
            "amountZatoshi": "1000000",
            "pcztHex": f.pczt_hex,
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
    let approval = open_request(&app, &f, 300).await;
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
        let (status, body) = call_as(
            &app,
            "/signer/commit",
            json!({ "approvalId": approval, "participantId": id, "commitmentsHex": hexes }),
            Some(&f.tokens[&id.clone()]),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "commit: {body}");
        sessions.insert(id.clone(), session);
    }

    // Round 2 becomes available only once threshold commitments are in.
    let (status, packages) = call_as(
        &app,
        "/signer/packages",
        json!({ "approvalId": approval, "participantId": signers[0], "commitmentsHex": [] }),
        Some(&f.tokens[&signers[0]]),
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
        let (status, body) = call_as(
            &app,
            "/signer/shares",
            json!({ "approvalId": approval, "participantId": id, "sharesHex": hexes }),
            Some(&f.tokens[&id.clone()]),
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
    let approval = open_request(&app, &f, 300).await;
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
        call_as(
            &app,
            "/signer/commit",
            json!({ "approvalId": approval, "participantId": id, "commitmentsHex": hexes }),
            Some(&f.tokens[&id.clone()]),
        )
        .await;
        sessions.insert(id.clone(), session);
    }

    let (_, packages) = call_as(
        &app,
        "/signer/packages",
        json!({ "approvalId": approval, "participantId": signers[0], "commitmentsHex": [] }),
        Some(&f.tokens[&signers[0]]),
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

    call_as(
        &app,
        "/signer/shares",
        json!({
            "approvalId": approval, "participantId": signers[1],
            "sharesHex": produced[&signers[1]].iter().map(|s| hex::encode(s.serialize())).collect::<Vec<_>>(),
        }),
        Some(&f.tokens[&signers[1]]),
    )
    .await;

    let (status, err) = call_as(
        &app,
        "/signer/shares",
        json!({
            "approvalId": approval, "participantId": signers[0],
            "sharesHex": swapped.iter().map(|s| hex::encode(s.serialize())).collect::<Vec<_>>(),
        }),
        Some(&f.tokens[&signers[0]]),
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
    let approval = open_request(&app, &f, 0).await; // deadline already passed

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

#[tokio::test]
async fn a_signer_must_prove_who_it_is() {
    // Without this, `participantId` is a claim. The round would still fail
    // cryptographically — a stranger has no share — but the event log would
    // name the wrong person, and naming the right one is the whole value of
    // F4. Constraint C5 also requires signing channels to be authenticated.
    let (app, f) = fixture().await;
    let approval = open_request(&app, &f, 300).await;
    let victim = f.tokens.keys().next().expect("a participant").clone();
    let body = json!({ "approvalId": approval, "participantId": victim, "commitmentsHex": [] });

    let (no_token, _) = call(&app, "/signer/commit", body.clone()).await;
    assert_eq!(
        no_token,
        StatusCode::UNAUTHORIZED,
        "no token must be refused"
    );

    let (wrong, err) = call_as(&app, "/signer/commit", body, Some("not-a-real-token")).await;
    assert_eq!(
        wrong,
        StatusCode::UNAUTHORIZED,
        "a forged token must be refused"
    );
    assert_eq!(err["code"], "UNAUTHORIZED");
}

/// A signer refuses a sighash that is not the transaction's own.
///
/// This is the check that makes the coordinator untrusted for *what* gets
/// signed, not merely for key material. Before it existed, `/signer/packages`
/// handed over a sighash and the signer signed it — so a compromised
/// coordinator could serve the sighash of a different transaction spending the
/// same vault, collect a valid threshold signature, and move the funds. Every
/// share would have verified. Aggregation would have succeeded. No signer
/// could have noticed.
#[tokio::test]
async fn a_signer_refuses_an_offer_that_does_not_match_the_transaction() {
    use quorum_core::transaction::{verify_offer, TransactionError};

    let mut rng = rand::thread_rng();
    let (_shares, pubkeys) =
        keys::generate_with_dealer::<Ciphersuite, _>(3, 2, IdentifierList::Default, &mut rng)
            .expect("dealer keygen");
    let ak = SpendValidatingKey::from_bytes(
        &pubkeys
            .verifying_key()
            .serialize()
            .expect("serialise group key"),
    )
    .expect("ak");
    let pczt = bind_fixture_to(&ak);

    // What the transaction actually says. A signer derives this itself.
    let truth = quorum_core::transaction::summarize(&pczt, &ak).expect("summarize");
    let alphas: Vec<[u8; 32]> = truth.spends.iter().map(|s| s.alpha).collect();

    // The honest offer is accepted.
    verify_offer(&pczt, &ak, &truth.sighash, &alphas).expect("the honest offer must be accepted");

    // A different sighash — the attack. One flipped bit is enough; in practice
    // it would be the sighash of a transaction paying the attacker.
    let mut lying = truth.sighash;
    lying[0] ^= 0x01;
    match verify_offer(&pczt, &ak, &lying, &alphas) {
        Err(TransactionError::SighashMismatch { offered, actual }) => {
            assert_eq!(offered, hex::encode(lying));
            assert_eq!(actual, hex::encode(truth.sighash));
        }
        other => panic!("a mismatched sighash must be refused, got {other:?}"),
    }

    // A different randomizer. Signing under the wrong alpha produces a
    // signature that verifies under FROST and authorizes nothing on chain —
    // so this has to be refused too, not just the sighash.
    let mut wrong_alphas = alphas.clone();
    wrong_alphas[0][0] ^= 0x01;
    match verify_offer(&pczt, &ak, &truth.sighash, &wrong_alphas) {
        Err(TransactionError::AlphaMismatch { .. }) => {}
        other => panic!("a mismatched randomizer must be refused, got {other:?}"),
    }

    // And too few randomizers: a coordinator asking us to sign one action of a
    // two-action transaction would leave the rest unauthorized.
    match verify_offer(&pczt, &ak, &truth.sighash, &[]) {
        Err(TransactionError::AlphaMismatch { .. }) => {}
        other => panic!("a short randomizer list must be refused, got {other:?}"),
    }
}

/// The coordinator hands the signer the transaction, not just a digest.
#[tokio::test]
async fn signer_routes_expose_the_transaction() {
    let (app, f) = fixture().await;
    let approval = open_request(&app, &f, 300).await;
    let participant = f.key_packages.keys().next().expect("a participant").clone();
    let token = f.tokens.get(&participant).expect("token").clone();

    let (status, body) = call_as(
        &app,
        "/signer/request",
        json!({ "approvalId": approval, "participantId": participant, "commitmentsHex": [] }),
        Some(&token),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "signer/request: {body}");

    // The transaction itself, before round 1 — because committing a nonce is
    // already an act, so a signer that can only look at round 2 has already
    // acted on trust.
    let hex_pczt = body["pcztHex"].as_str().expect("pcztHex");
    assert_eq!(
        hex_pczt, f.pczt_hex,
        "must be the transaction under approval"
    );

    // And the proposer's figures are labelled as claims rather than presented
    // as facts, because a shielded output need not state either in the clear.
    assert!(body["claimedRecipient"].is_string());
    assert!(
        body["note"].as_str().unwrap_or_default().contains("claims"),
        "the response must say these are claims: {body}"
    );

    // Without a token it is refused: participantId alone is an assertion.
    let (status, _) = call(
        &app,
        "/signer/request",
        json!({ "approvalId": approval, "participantId": participant, "commitmentsHex": [] }),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

/// Enough declines closes the request instead of leaving it open.
///
/// Before the consent gate existed, nothing ever declined in practice, so a
/// request whose quorum had become unreachable simply sat at PENDING until its
/// deadline — telling a treasurer to keep waiting for something that could not
/// happen.
#[tokio::test]
async fn declining_past_the_threshold_closes_the_request() {
    let (app, f) = fixture().await;
    let approval = open_request(&app, &f, 300).await;
    let participants: Vec<String> = f.key_packages.keys().cloned().collect();

    // 3 participants, threshold 2. One decline still leaves two possible.
    let (status, body) = call_as(
        &app,
        "/signer/decline",
        json!({ "approvalId": approval, "participantId": participants[0] }),
        Some(f.tokens.get(&participants[0]).expect("token")),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        body["status"], "PENDING",
        "one decline of three still leaves a reachable quorum"
    );

    // The second decline makes two-of-three impossible.
    let (status, body) = call_as(
        &app,
        "/signer/decline",
        json!({ "approvalId": approval, "participantId": participants[1] }),
        Some(f.tokens.get(&participants[1]).expect("token")),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["status"], "REJECTED", "the quorum is now unreachable");

    let closing = body["events"]
        .as_array()
        .expect("events")
        .iter()
        .find(|e| e["errorCode"] == "QUORUM_UNREACHABLE")
        .expect("a closing event explaining why");

    // Declining is the system working. The log must not read as an accusation.
    assert_eq!(closing["culpritDetected"], false);
    let detail = closing["errorDetails"].as_str().unwrap_or_default();
    assert!(detail.contains("no funds moved"), "{detail}");
    assert!(
        detail.contains("not a fault"),
        "a decline is a decision, and the message should say so: {detail}"
    );
}
