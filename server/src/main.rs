//! Tym server: serves the built web app and syncs data between devices.
//!
//! Configuration (environment variables):
//! - `TYM_TOKEN` (required): shared secret clients send as `Authorization: Bearer <token>`.
//! - `TYM_ADDR`: listen address, default `127.0.0.1:8080`.
//! - `TYM_DB`: SQLite database path, default `tym.db`.
//! - `TYM_STATIC_DIR`: built front end to serve, default `../dist`.

mod app;
mod db;
mod sync;

use std::path::PathBuf;
use std::sync::Arc;

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,tower_http=info".into()),
        )
        .init();

    let token = match std::env::var("TYM_TOKEN") {
        Ok(token) if !token.trim().is_empty() => token,
        _ => {
            eprintln!("TYM_TOKEN must be set to the secret clients use to sync.");
            std::process::exit(1);
        }
    };
    if token.len() < 16 {
        tracing::warn!(
            "TYM_TOKEN is shorter than 16 characters; use a long random value outside local development"
        );
    }
    let addr = std::env::var("TYM_ADDR").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let db_path = PathBuf::from(std::env::var("TYM_DB").unwrap_or_else(|_| "tym.db".into()));
    let static_dir =
        PathBuf::from(std::env::var("TYM_STATIC_DIR").unwrap_or_else(|_| "../dist".into()));

    let store = match db::Store::open(&db_path) {
        Ok(store) => Arc::new(store),
        Err(err) => {
            eprintln!("Couldn't open database {}: {err}", db_path.display());
            std::process::exit(1);
        }
    };
    if !static_dir.join("index.html").exists() {
        tracing::warn!(
            "{} has no index.html; run `bun run build` to serve the app",
            static_dir.display()
        );
    }

    let router = app::router(
        app::AppState {
            store,
            token: Arc::from(token),
        },
        &static_dir,
    );
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!("Couldn't listen on {addr}: {err}");
            std::process::exit(1);
        }
    };
    tracing::info!("serving {} on http://{addr}", static_dir.display());
    axum::serve(listener, router)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("server error");
}
