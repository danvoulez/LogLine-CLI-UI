use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Query, Request, State};
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::{get, post};
use axum::{Json, Router};
use clap::Parser;
use logline_api::{Intent, RuntimeEngine};
use logline_auth::{JwksSource, JwtVerifier, VerifyOptions, VerifiedJwt};
use logline_core::{default_config_dir, demo_catalog, load_catalog_from_dir};
use logline_runtime::LoglineRuntime;
use rand::distr::{Alphanumeric, SampleString};
use serde::Deserialize;

#[derive(Debug, Parser)]
#[command(name = "logline-daemon", about = "Logline runtime daemon")]
struct Args {
    #[arg(long, default_value = "127.0.0.1")]
    host: String,
    #[arg(long, default_value_t = 7600)]
    port: u16,
    #[arg(long)]
    config_dir: Option<PathBuf>,

    /// API token for protected routes. Can also be set via LOGLINE_DAEMON_TOKEN.
    #[arg(long)]
    token: Option<String>,

    /// JWKS endpoint for JWT bearer auth. Can also be set via LOGLINE_JWKS_URL.
    #[arg(long)]
    jwks_url: Option<String>,

    /// Expected JWT issuer. Can also be set via LOGLINE_JWT_ISSUER.
    #[arg(long)]
    jwt_issuer: Option<String>,

    /// Expected JWT audience. Can also be set via LOGLINE_JWT_AUDIENCE.
    #[arg(long)]
    jwt_audience: Option<String>,

    /// If true, reject JWTs without `kid`.
    #[arg(long, default_value_t = true)]
    jwt_require_kid: bool,

    /// If set, daemon starts without token auth (not recommended).
    #[arg(long, default_value_t = false)]
    allow_unauthenticated: bool,
}

#[derive(Clone)]
struct JwtAuthConfig {
    verifier: JwtVerifier,
    source: JwksSource,
    options: VerifyOptions,
}

#[derive(Clone)]
struct AppState {
    runtime: Arc<LoglineRuntime>,
    bootstrap_token: Option<Arc<str>>,
    sessions: Arc<RwLock<HashMap<String, SessionToken>>>,
    jwt_auth: Option<JwtAuthConfig>,
}

#[derive(Clone, Debug)]
struct SessionToken {
    expires_at_unix_ms: i64,
    created_at_unix_ms: i64,
    label: Option<String>,
}

enum AuthIdentity {
    Bootstrap,
    Session(SessionToken),
    Jwt(VerifiedJwt),
}

#[derive(Debug, Deserialize)]
struct EventsQuery {
    since: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StopRequest {
    run_id: String,
}

#[derive(Debug, Deserialize)]
struct TestBackendRequest {
    backend_id: String,
}

#[derive(Debug, Deserialize)]
struct SelectProfileRequest {
    profile_id: String,
}

#[derive(Debug, Deserialize)]
struct CreateSessionRequest {
    ttl_seconds: Option<u64>,
    label: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RevokeSessionRequest {
    token: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = Args::parse();
    let config_dir = args.config_dir.unwrap_or_else(default_config_dir);
    let token = args
        .token
        .or_else(|| std::env::var("LOGLINE_DAEMON_TOKEN").ok());
    let jwks_url = args
        .jwks_url
        .or_else(|| std::env::var("LOGLINE_JWKS_URL").ok());
    let jwt_issuer = args
        .jwt_issuer
        .or_else(|| std::env::var("LOGLINE_JWT_ISSUER").ok());
    let jwt_audience = args
        .jwt_audience
        .or_else(|| std::env::var("LOGLINE_JWT_AUDIENCE").ok());
    let jwt_require_kid = std::env::var("LOGLINE_JWT_REQUIRE_KID")
        .ok()
        .and_then(|v| v.parse::<bool>().ok())
        .unwrap_or(args.jwt_require_kid);

    let jwt_auth = jwks_url.as_ref().map(|jwks_url| JwtAuthConfig {
        verifier: JwtVerifier::default(),
        source: JwksSource::Url(jwks_url.clone()),
        options: VerifyOptions {
            jwks_url: jwks_url.clone(),
            issuer: jwt_issuer.clone(),
            audience: jwt_audience.clone(),
            require_kid: jwt_require_kid,
            ..Default::default()
        },
    });
    let auth_required = token.is_some() || jwt_auth.is_some();

    if token.is_none() && jwt_auth.is_none() && !args.allow_unauthenticated {
        anyhow::bail!(
            "missing auth configuration. Set --token/LOGLINE_DAEMON_TOKEN or --jwks-url/LOGLINE_JWKS_URL, or use --allow-unauthenticated for local testing"
        );
    }

    let catalog = match load_catalog_from_dir(&config_dir) {
        Ok(c) => c,
        Err(_) => demo_catalog(),
    };
    let runtime = Arc::new(LoglineRuntime::from_catalog(catalog)?);
    let app_state = AppState {
        runtime,
        bootstrap_token: token.map(Arc::<str>::from),
        sessions: Arc::new(RwLock::new(HashMap::new())),
        jwt_auth,
    };
    let bootstrap_token_auth_enabled = app_state.bootstrap_token.is_some();
    let jwt_auth_enabled = app_state.jwt_auth.is_some();

    let protected = Router::new()
        .route("/v1/status", get(status))
        .route("/v1/events", get(events))
        .route("/v1/intents/run", post(run_intent))
        .route("/v1/intents/stop", post(stop_intent))
        .route("/v1/backends/test", post(test_backend))
        .route("/v1/profiles/select", post(select_profile))
        .route("/v1/auth/whoami", get(whoami))
        .route_layer(middleware::from_fn_with_state(app_state.clone(), require_token));

    let admin = Router::new()
        .route("/v1/auth/session/create", post(create_session_token))
        .route("/v1/auth/session/revoke", post(revoke_session_token))
        .route("/v1/auth/session/list", get(list_session_tokens))
        .route_layer(middleware::from_fn_with_state(app_state.clone(), require_admin_token));

    let app = Router::new()
        .route("/v1/health", get(health))
        .merge(admin)
        .merge(protected)
        .with_state(app_state);

    let bind = format!("{}:{}", args.host, args.port);
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    println!(
        "{}",
        serde_json::to_string_pretty(&serde_json::json!({
            "message":"logline daemon running",
            "bind": bind,
            "auth_required": auth_required,
            "bootstrap_token_auth_enabled": bootstrap_token_auth_enabled,
            "jwt_auth_enabled": jwt_auth_enabled,
            "auth_header": "x-logline-token or Authorization: Bearer <token>"
        }))?
    );
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true }))
}

async fn require_admin_token(
    State(auth): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let expected = if let Some(t) = auth.bootstrap_token {
        t
    } else if auth.jwt_auth.is_none() {
        // Dev mode: no auth configured.
        return Ok(next.run(request).await);
    } else {
        // JWT-only mode: admin routes must stay bootstrap-token protected.
        return Err(StatusCode::FORBIDDEN);
    };

    let provided = header_token(request.headers());
    if provided.as_deref() == Some(expected.as_ref()) {
        Ok(next.run(request).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

async fn require_token(
    State(auth): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let provided = header_token(request.headers());

    // No auth configured (dev mode only)
    if auth.bootstrap_token.is_none() && auth.jwt_auth.is_none() {
        return Ok(next.run(request).await);
    }

    let Some(token) = provided.as_deref() else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    if resolve_auth_identity(&auth, token).await.is_some() {
        Ok(next.run(request).await)
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

fn header_token(headers: &axum::http::HeaderMap) -> Option<String> {
    if let Some(value) = headers.get("x-logline-token") {
        if let Ok(s) = value.to_str() {
            return Some(s.to_string());
        }
    }
    if let Some(value) = headers.get("authorization") {
        if let Ok(s) = value.to_str() {
            if let Some(rest) = s.strip_prefix("Bearer ") {
                return Some(rest.to_string());
            }
        }
    }
    None
}

fn resolve_token_identity(auth: &AppState, token: &str) -> Option<AuthIdentity> {
    if auth
        .bootstrap_token
        .as_ref()
        .is_some_and(|expected| token == expected.as_ref())
    {
        return Some(AuthIdentity::Bootstrap);
    }

    let now = now_ms();
    let Ok(mut sessions) = auth.sessions.write() else {
        return None;
    };
    sessions.retain(|_, s| s.expires_at_unix_ms > now);
    sessions.get(token).cloned().map(AuthIdentity::Session)
}

async fn resolve_jwt_identity(auth: &AppState, token: &str) -> Option<AuthIdentity> {
    let Some(jwt) = auth.jwt_auth.as_ref() else {
        return None;
    };

    jwt.verifier
        .verify_with_source(token, jwt.source.clone(), jwt.options.clone())
        .await
        .ok()
        .map(AuthIdentity::Jwt)
}

async fn resolve_auth_identity(auth: &AppState, token: &str) -> Option<AuthIdentity> {
    if let Some(identity) = resolve_token_identity(auth, token) {
        return Some(identity);
    }
    resolve_jwt_identity(auth, token).await
}

fn token_prefix(token: &str) -> String {
    token.chars().take(10).collect::<String>()
}

async fn whoami(
    State(auth): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(token) = header_token(&headers) else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "missing auth token" })),
        ));
    };

    let Some(identity) = resolve_auth_identity(&auth, &token).await else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "unauthorized" })),
        ));
    };

    let body = match identity {
        AuthIdentity::Bootstrap => serde_json::json!({
            "auth_type": "bootstrap_token",
            "token_prefix": token_prefix(&token),
        }),
        AuthIdentity::Session(session) => serde_json::json!({
            "auth_type": "session_token",
            "token_prefix": token_prefix(&token),
            "created_at_unix_ms": session.created_at_unix_ms,
            "expires_at_unix_ms": session.expires_at_unix_ms,
            "label": session.label,
        }),
        AuthIdentity::Jwt(verified) => serde_json::json!({
            "auth_type": "jwt",
            "token_prefix": token_prefix(&token),
            "header": verified.header,
            "claims": verified.claims,
            "subject": verified.sub(),
            "issuer": verified.iss(),
            "audience": verified.aud(),
            "expires_at_unix": verified.exp(),
        }),
    };

    Ok(Json(body))
}

async fn status(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    map_result(state.runtime.status().map(|s| serde_json::to_value(s).expect("serializable")))
}

async fn events(
    State(state): State<AppState>,
    Query(query): Query<EventsQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    map_result(
        state
            .runtime
            .events_since(query.since)
            .map(|e| serde_json::to_value(e).expect("serializable")),
    )
}

async fn run_intent(
    State(state): State<AppState>,
    Json(intent): Json<Intent>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    map_result(
        state
            .runtime
            .run_intent(intent)
            .map(|r| serde_json::to_value(r).expect("serializable")),
    )
}

async fn stop_intent(
    State(state): State<AppState>,
    Json(body): Json<StopRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    map_result(
        state
            .runtime
            .stop_run(body.run_id.clone())
            .map(|()| serde_json::json!({"ok": true, "run_id": body.run_id})),
    )
}

async fn test_backend(
    State(state): State<AppState>,
    Json(body): Json<TestBackendRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    map_result(
        state
            .runtime
            .test_backend(body.backend_id.clone())
            .map(|()| serde_json::json!({"ok": true, "backend_id": body.backend_id})),
    )
}

async fn select_profile(
    State(state): State<AppState>,
    Json(body): Json<SelectProfileRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    map_result(
        state
            .runtime
            .select_profile(body.profile_id.clone())
            .map(|()| serde_json::json!({"ok": true, "profile_id": body.profile_id})),
    )
}

async fn create_session_token(
    State(auth): State<AppState>,
    Json(body): Json<CreateSessionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let ttl = body.ttl_seconds.unwrap_or(3_600);
    if !(60..=604_800).contains(&ttl) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "ttl_seconds must be between 60 and 604800"
            })),
        ));
    }

    let token = issue_session_token();
    let now = now_ms();
    let expires_at = now + (ttl as i64 * 1000);

    let session = SessionToken {
        created_at_unix_ms: now,
        expires_at_unix_ms: expires_at,
        label: body.label.clone(),
    };

    {
        let mut sessions = auth
            .sessions
            .write()
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({ "error": "session lock poisoned" })),
                )
            })?;
        sessions.insert(token.clone(), session);
    }

    Ok(Json(serde_json::json!({
        "token": token,
        "created_at_unix_ms": now,
        "expires_at_unix_ms": expires_at,
        "ttl_seconds": ttl
    })))
}

async fn revoke_session_token(
    State(auth): State<AppState>,
    Json(body): Json<RevokeSessionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let mut sessions = auth
        .sessions
        .write()
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "session lock poisoned" })),
            )
        })?;
    let removed = sessions.remove(&body.token).is_some();
    Ok(Json(serde_json::json!({ "ok": removed })))
}

async fn list_session_tokens(
    State(auth): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let now = now_ms();
    let mut sessions = auth
        .sessions
        .write()
        .map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "session lock poisoned" })),
            )
        })?;

    sessions.retain(|_, s| s.expires_at_unix_ms > now);

    let items: Vec<_> = sessions
        .iter()
        .map(|(token, s)| {
            serde_json::json!({
                "token_prefix": token.chars().take(10).collect::<String>(),
                "created_at_unix_ms": s.created_at_unix_ms,
                "expires_at_unix_ms": s.expires_at_unix_ms,
                "label": s.label,
            })
        })
        .collect();

    Ok(Json(serde_json::json!({
        "active_sessions": items.len(),
        "items": items
    })))
}

fn map_result<T: serde::Serialize>(
    result: Result<T, logline_api::LoglineError>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match result {
        Ok(v) => Ok(Json(serde_json::to_value(v).expect("serializable"))),
        Err(e) => {
            let status = match e {
                logline_api::LoglineError::Validation(_) => StatusCode::BAD_REQUEST,
                logline_api::LoglineError::Auth(_) => StatusCode::UNAUTHORIZED,
                logline_api::LoglineError::Connection(_) => StatusCode::BAD_GATEWAY,
                logline_api::LoglineError::Conflict(_) => StatusCode::CONFLICT,
                logline_api::LoglineError::NotFound(_) => StatusCode::NOT_FOUND,
                logline_api::LoglineError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
            };
            Err((status, Json(serde_json::json!({ "error": e.to_string() }))))
        }
    }
}

fn issue_session_token() -> String {
    let mut rng = rand::rng();
    let token = Alphanumeric.sample_string(&mut rng, 40);
    format!("llt_{token}")
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as i64)
}
