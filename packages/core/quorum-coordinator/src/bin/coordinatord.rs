//! The coordinator service.
//!
//! ```sh
//! cargo run -p quorum-coordinator --bin quorum-coordinatord
//! ```
//!
//! Serves the integration contract on `127.0.0.1:2745`. Holds no key
//! material: shares live on participants' machines and never arrive here.

use quorum_coordinator::{routes::router, service::AppState};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    let addr =
        std::env::var("QUORUM_COORDINATOR_ADDR").unwrap_or_else(|_| "127.0.0.1:2745".to_string());

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| panic!("cannot bind {addr}: {e}"));

    tracing::info!("coordinator listening on {addr}");
    tracing::info!("testnet only — this build cannot touch mainnet");

    axum::serve(listener, router(AppState::new()))
        .await
        .expect("server failed");
}
