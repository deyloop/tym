//! HTTP routes: `/api/*` for sync, everything else serves the web app.

use std::path::Path;
use std::sync::Arc;

use axum::extract::{DefaultBodyLimit, Request, State};
use axum::http::{StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use tower_http::compression::CompressionLayer;
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;

use crate::db::Store;
use crate::sync::{SyncRequest, SyncResponse};

const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<Store>,
    pub token: Arc<str>,
}

pub fn router(state: AppState, static_dir: &Path) -> Router {
    let api = Router::new()
        .route("/sync", post(sync))
        .route_layer(middleware::from_fn_with_state(state.clone(), require_token))
        .route("/health", get(|| async { "ok" }))
        .fallback(|| async { (StatusCode::NOT_FOUND, "no such API endpoint") });

    // The app uses hash routing, but fall back to index.html for any unknown path anyway.
    let web = ServeDir::new(static_dir).fallback(ServeFile::new(static_dir.join("index.html")));

    Router::new()
        .nest("/api", api)
        .fallback_service(web)
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn require_token(State(state): State<AppState>, request: Request, next: Next) -> Response {
    let provided = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "));
    match provided {
        Some(token) if constant_time_eq(token.as_bytes(), state.token.as_bytes()) => {
            next.run(request).await
        }
        _ => (StatusCode::UNAUTHORIZED, "missing or wrong sync token").into_response(),
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

async fn sync(State(state): State<AppState>, Json(request): Json<SyncRequest>) -> Response {
    if let Some(err) = request.changes.iter().find_map(|c| c.validate().err()) {
        return (StatusCode::BAD_REQUEST, err).into_response();
    }
    let result =
        tokio::task::spawn_blocking(move || state.store.sync(request.cursor, &request.changes))
            .await;
    match result {
        Ok(Ok((cursor, changes))) => Json(SyncResponse { cursor, changes }).into_response(),
        Ok(Err(err)) => {
            tracing::error!("sync failed: {err}");
            (StatusCode::INTERNAL_SERVER_ERROR, "sync failed").into_response()
        }
        Err(err) => {
            tracing::error!("sync task panicked: {err}");
            (StatusCode::INTERNAL_SERVER_ERROR, "sync failed").into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http_body_util::BodyExt;
    use serde_json::{Value, json};
    use tower::ServiceExt;

    fn app() -> Router {
        let state = AppState {
            store: Arc::new(Store::open_in_memory().unwrap()),
            token: Arc::from("secret"),
        };
        router(state, Path::new("/nonexistent"))
    }

    async fn post_sync(app: &Router, token: Option<&str>, body: Value) -> (StatusCode, Value) {
        let mut request =
            Request::post("/api/sync").header(header::CONTENT_TYPE, "application/json");
        if let Some(token) = token {
            request = request.header(header::AUTHORIZATION, format!("Bearer {token}"));
        }
        let response = app
            .clone()
            .oneshot(request.body(Body::from(body.to_string())).unwrap())
            .await
            .unwrap();
        let status = response.status();
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        (
            status,
            serde_json::from_slice(&bytes).unwrap_or(Value::Null),
        )
    }

    #[tokio::test]
    async fn sync_requires_the_token() {
        let app = app();
        assert_eq!(
            post_sync(&app, None, json!({})).await.0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            post_sync(&app, Some("wrong"), json!({})).await.0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            post_sync(&app, Some("secret"), json!({})).await.0,
            StatusCode::OK
        );
    }

    #[tokio::test]
    async fn health_is_public() {
        let response = app()
            .oneshot(Request::get("/api/health").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn invalid_changes_are_rejected() {
        let body = json!({ "cursor": 0, "changes": [{ "collection": "nope", "id": "x", "updatedAt": 1, "data": {} }] });
        assert_eq!(
            post_sync(&app(), Some("secret"), body).await.0,
            StatusCode::BAD_REQUEST
        );
    }

    #[tokio::test]
    async fn two_devices_converge() {
        let app = app();
        let person = |name: &str, at: i64| json!({ "collection": "people", "id": "p1", "updatedAt": at, "data": { "id": "p1", "name": name } });

        // Device A creates a person.
        let (_, a) = post_sync(
            &app,
            Some("secret"),
            json!({ "cursor": 0, "changes": [person("Ann", 1)] }),
        )
        .await;
        let a_cursor = a["cursor"].as_i64().unwrap();

        // Device B pulls it, then renames it.
        let (_, b) = post_sync(&app, Some("secret"), json!({ "cursor": 0, "changes": [] })).await;
        assert_eq!(b["changes"][0]["data"]["name"], "Ann");
        post_sync(
            &app,
            Some("secret"),
            json!({ "cursor": b["cursor"], "changes": [person("Anne", 2)] }),
        )
        .await;

        // Device A pulls the rename.
        let (_, a2) = post_sync(
            &app,
            Some("secret"),
            json!({ "cursor": a_cursor, "changes": [] }),
        )
        .await;
        assert_eq!(a2["changes"].as_array().unwrap().len(), 1);
        assert_eq!(a2["changes"][0]["data"]["name"], "Anne");
    }

    #[tokio::test]
    async fn unknown_api_path_is_404_not_the_app() {
        let response = app()
            .oneshot(Request::get("/api/nope").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}
