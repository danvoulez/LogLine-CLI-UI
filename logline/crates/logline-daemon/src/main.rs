use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Path, Query, Request, State};
use axum::http::StatusCode;
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::{delete, get, patch, post, put};
use axum::{Json, Router};
use clap::Parser;
use logline_api::{Intent, RuntimeEngine};
use logline_auth::{JwksSource, JwtVerifier, VerifiedJwt, VerifyOptions};
use logline_core::{default_config_dir, demo_catalog, load_catalog_from_dir};
use logline_runtime::LoglineRuntime;
use rand::distr::{Alphanumeric, SampleString};
use serde::Deserialize;
use serde_json::Value;
use tokio_postgres::{Client as PgClient, NoTls};
use base64::Engine;
use ring::{digest, signature};

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
    db: Option<Arc<PgClient>>,
    auth_provider_mode: String,
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

#[derive(Debug, Deserialize)]
struct TenantResolveRequest {
    slug: Option<String>,
    #[allow(dead_code)]
    invite_code: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OnboardClaimRequest {
    tenant_slug: Option<String>,
    display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AppDefaultEntry {
    app_id: Option<String>,
    role: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateCliChallengeRequest {
    device_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChallengePath {
    #[serde(rename = "challengeId")]
    challenge_id: String,
}

#[derive(Debug, Deserialize)]
struct ApproveCliChallengeRequest {
    action: String,
}

#[derive(Debug, Deserialize)]
struct FounderKeyRegisterRequest {
    public_key: String,
    algorithm: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FounderIntentVerifyRequest {
    signing_key_id: String,
    nonce: String,
    payload: Value,
    signature: String,
    expires_at: String,
    tenant_id: Option<String>,
    app_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FounderActionExecuteRequest {
    intent_id: String,
}

#[derive(Debug, Deserialize)]
struct AppKeyPath {
    #[serde(rename = "appId")]
    app_id: String,
}

#[derive(Debug, Deserialize)]
struct AddUserKeyRequest {
    provider: String,
    key_label: String,
    encrypted_key: String,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct ScopeQuery {
    workspace_id: Option<String>,
    app_id: Option<String>,
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct InstalledComponentBody {
    #[serde(rename = "componentId")]
    component_id: String,
}

#[derive(Debug, Deserialize)]
struct InstalledComponentPath {
    #[serde(rename = "componentId")]
    component_id: String,
}

#[derive(Debug, Deserialize, Default)]
struct StatusLogQuery {
    limit: Option<i64>,
    #[serde(flatten)]
    scope: ScopeQuery,
}

#[derive(Debug, Deserialize)]
struct StatusLogBody {
    service_name: String,
    status: String,
    latency_ms: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct ChatQuery {
    session_id: Option<String>,
    #[serde(flatten)]
    scope: ScopeQuery,
}

#[derive(Debug, Deserialize)]
struct ChatBody {
    session_id: String,
    role: String,
    content: String,
    panel_id: Option<String>,
    instance_id: Option<String>,
    model_used: Option<String>,
    latency_ms: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct SettingsPatchBody {
    key: String,
    value: Value,
}

#[derive(Debug, Deserialize)]
struct InstanceConfigPath {
    #[serde(rename = "instanceId")]
    instance_id: String,
}

#[derive(Debug, Deserialize)]
struct InstanceConfigPutBody {
    source_hub: Option<String>,
    source_origin: Option<String>,
    source_auth_ref: Option<String>,
    source_mode: Option<String>,
    source_interval_ms: Option<i64>,
    proc_executor: Option<String>,
    proc_command: Option<String>,
    proc_args: Option<Vec<String>>,
    proc_timeout_ms: Option<i64>,
    proc_retries: Option<i64>,
    proc_backoff: Option<String>,
    proc_error_mode: Option<String>,
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
    let auth_provider_mode = std::env::var("AUTH_PROVIDER_MODE")
        .unwrap_or_else(|_| "jwt".to_string())
        .trim()
        .to_lowercase();

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

    let database_url = std::env::var("DATABASE_URL")
        .ok()
        .or_else(|| std::env::var("DATABASE_URL_UNPOOLED").ok())
        .or_else(|| std::env::var("POSTGRES_URL").ok());

    let db = if let Some(url) = database_url {
        match tokio_postgres::connect(&url, NoTls).await {
            Ok((client, connection)) => {
                tokio::spawn(async move {
                    if let Err(err) = connection.await {
                        eprintln!("postgres connection error: {err}");
                    }
                });
                Some(Arc::new(client))
            }
            Err(err) => {
                eprintln!("failed to connect postgres: {err}");
                None
            }
        }
    } else {
        None
    };

    let runtime = Arc::new(LoglineRuntime::from_catalog(catalog)?);
    let app_state = AppState {
        runtime,
        bootstrap_token: token.map(Arc::<str>::from),
        sessions: Arc::new(RwLock::new(HashMap::new())),
        jwt_auth,
        db,
        auth_provider_mode: auth_provider_mode.clone(),
    };
    let bootstrap_token_auth_enabled = app_state.bootstrap_token.is_some();
    let jwt_auth_enabled = app_state.jwt_auth.is_some();
    let db_enabled = app_state.db.is_some();

    let protected = Router::new()
        .route("/v1/status", get(status))
        .route("/v1/events", get(events))
        .route("/v1/intents/run", post(run_intent))
        .route("/v1/intents/stop", post(stop_intent))
        .route("/v1/backends/test", post(test_backend))
        .route("/v1/profiles/select", post(select_profile))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_token,
        ));

    let admin = Router::new()
        .route("/v1/auth/session/create", post(create_session_token))
        .route("/v1/auth/session/revoke", post(revoke_session_token))
        .route("/v1/auth/session/list", get(list_session_tokens))
        .route_layer(middleware::from_fn_with_state(
            app_state.clone(),
            require_admin_token,
        ));

    let app = Router::new()
        .route("/v1/health", get(health))
        .route("/v1/auth/tenant/resolve", post(tenant_resolve))
        .route("/v1/auth/onboard/claim", post(onboard_claim))
        .route("/v1/auth/whoami", get(whoami))
        .route("/v1/cli/auth/challenge", post(create_cli_auth_challenge))
        .route(
            "/v1/cli/auth/challenge/{challengeId}/status",
            get(cli_auth_challenge_status),
        )
        .route(
            "/v1/cli/auth/challenge/{challengeId}/approve",
            post(cli_auth_challenge_approve),
        )
        .route("/v1/founder/keys/register", post(founder_keys_register))
        .route("/v1/founder/intents/verify", post(founder_intents_verify))
        .route("/v1/founder/actions/execute", post(founder_actions_execute))
        .route("/v1/apps/{appId}/keys/user", get(list_user_keys))
        .route("/v1/apps/{appId}/keys/user", post(add_user_key))
        .route("/v1/chat", get(get_chat_messages))
        .route("/v1/chat", post(post_chat_message))
        .route("/v1/settings", get(get_settings))
        .route("/v1/settings", patch(patch_settings))
        .route("/v1/status-log", get(get_status_log))
        .route("/v1/status-log", post(post_status_log))
        .route("/v1/installed-components", get(list_installed_components))
        .route("/v1/installed-components", post(add_installed_component))
        .route(
            "/v1/installed-components/{componentId}",
            delete(remove_installed_component),
        )
        .route(
            "/v1/instance-configs/{instanceId}",
            get(get_instance_config),
        )
        .route(
            "/v1/instance-configs/{instanceId}",
            put(upsert_instance_config),
        )
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
            "db_enabled": db_enabled,
            "auth_provider_mode": auth_provider_mode,
            "auth_header": "x-logline-token or Authorization: Bearer <token>"
        }))?
    );
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true }))
}

async fn tenant_resolve(
    State(state): State<AppState>,
    Json(body): Json<TenantResolveRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let slug = body.slug.unwrap_or_default().trim().to_string();
    if slug.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "slug is required" })),
        ));
    }

    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let tenant_rows = db
        .query(
            "select tenant_id, name, slug from tenants where slug = $1 limit 1",
            &[&slug],
        )
        .await
        .map_err(db_query_error)?;

    if tenant_rows.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Tenant not found" })),
        ));
    }

    let tenant = &tenant_rows[0];
    let tenant_id: String = tenant.get("tenant_id");
    let tenant_name: String = tenant.get("name");
    let tenant_slug: String = tenant.get("slug");

    let allowlist_rows = db
        .query(
            "select 1 from tenant_email_allowlist where tenant_id = $1 limit 1",
            &[&tenant_id],
        )
        .await
        .map_err(db_query_error)?;

    Ok(Json(serde_json::json!({
        "tenant_id": tenant_id,
        "name": tenant_name,
        "slug": tenant_slug,
        "has_allowlist": !allowlist_rows.is_empty(),
    })))
}

fn db_query_error(err: tokio_postgres::Error) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(serde_json::json!({ "error": format!("database query failed: {err}") })),
    )
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

fn header_value(headers: &axum::http::HeaderMap, key: &str) -> Option<String> {
    headers
        .get(key)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn authorization_bearer_token(headers: &axum::http::HeaderMap) -> Option<String> {
    let raw = header_value(headers, "authorization")?;
    raw.strip_prefix("Bearer ")
        .or_else(|| raw.strip_prefix("bearer "))
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(ToString::to_string)
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

async fn identity_whoami(
    auth: &AppState,
    headers: &axum::http::HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(token) = header_token(headers) else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "missing auth token" })),
        ));
    };

    let Some(identity) = resolve_auth_identity(auth, &token).await else {
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

async fn onboard_claim(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<OnboardClaimRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let tenant_slug = body.tenant_slug.unwrap_or_default().trim().to_string();
    if tenant_slug.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "tenant_slug is required" })),
        ));
    }

    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    if state.jwt_auth.is_none() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "JWT auth is not configured" })),
        ));
    }

    // Route parity with Next.js: onboarding claim requires a valid Bearer JWT.
    let Some(token) = authorization_bearer_token(&headers) else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Authorization header required" })),
        ));
    };

    let Some(identity) = resolve_jwt_identity(&state, &token).await else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized: invalid Bearer token" })),
        ));
    };
    let AuthIdentity::Jwt(verified) = identity else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized: JWT required" })),
        ));
    };

    let Some(user_id) = verified.sub().map(ToString::to_string) else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized: JWT missing sub claim" })),
        ));
    };
    let email = verified
        .claim("email")
        .and_then(|value| value.as_str())
        .map(ToString::to_string);
    let email_norm = email
        .as_ref()
        .map(|value| value.to_lowercase().trim().to_string());

    let tenant_rows = db
        .query(
            "select tenant_id from tenants where slug = $1 limit 1",
            &[&tenant_slug],
        )
        .await
        .map_err(db_query_error)?;
    if tenant_rows.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": format!("Unknown tenant slug: {tenant_slug}") })),
        ));
    }
    let tenant_id: String = tenant_rows[0].get("tenant_id");

    let allowlist_exists_row = db
        .query_one(
            "select exists(select 1 from tenant_email_allowlist where tenant_id = $1) as has_allowlist",
            &[&tenant_id],
        )
        .await
        .map_err(db_query_error)?;
    let has_allowlist: bool = allowlist_exists_row.get("has_allowlist");

    let mut tenant_role = "member".to_string();
    let mut app_defaults: Vec<AppDefaultEntry> = Vec::new();

    if has_allowlist {
        let Some(normalized_email) = email_norm.as_ref() else {
            return Err((
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({
                    "error": format!("Email-based signup is required for tenant {tenant_slug}")
                })),
            ));
        };

        let match_rows = db
            .query(
                "select role_default, app_defaults::text as app_defaults \
                 from tenant_email_allowlist \
                 where tenant_id = $1 and email_normalized = $2 \
                   and (expires_at is null or expires_at > now()) \
                 limit 1",
                &[&tenant_id, normalized_email],
            )
            .await
            .map_err(db_query_error)?;

        if match_rows.is_empty() {
            return Err((
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({
                    "error": format!("Email {} is not on the allowlist for tenant {tenant_slug}", email.clone().unwrap_or_default())
                })),
            ));
        }

        tenant_role = match_rows[0].get::<_, String>("role_default");
        let app_defaults_text: String = match_rows[0].get("app_defaults");
        app_defaults =
            serde_json::from_str::<Vec<AppDefaultEntry>>(&app_defaults_text).unwrap_or_default();
    }

    let display_name = body
        .display_name
        .and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        })
        .or_else(|| email.clone())
        .unwrap_or_else(|| user_id.clone());

    db.execute(
        "insert into users (user_id, email, display_name, created_at) \
         values ($1, $2, $3, now()) \
         on conflict do nothing",
        &[&user_id, &email, &display_name],
    )
    .await
    .map_err(db_query_error)?;

    db.execute(
        "insert into tenant_memberships (tenant_id, user_id, role, created_at) \
         values ($1, $2, $3, now()) \
         on conflict do nothing",
        &[&tenant_id, &user_id, &tenant_role],
    )
    .await
    .map_err(db_query_error)?;

    for entry in &app_defaults {
        let Some(app_id) = entry
            .app_id
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(ToString::to_string)
        else {
            continue;
        };

        let app_exists = db
            .query(
                "select 1 from apps where app_id = $1 and tenant_id = $2 limit 1",
                &[&app_id, &tenant_id],
            )
            .await
            .map_err(db_query_error)?;

        if app_exists.is_empty() {
            continue;
        }

        let role = entry
            .role
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or("member")
            .to_string();

        db.execute(
            "insert into app_memberships (app_id, tenant_id, user_id, role, created_at) \
             values ($1, $2, $3, $4, now()) \
             on conflict do nothing",
            &[&app_id, &tenant_id, &user_id, &role],
        )
        .await
        .map_err(db_query_error)?;
    }

    Ok(Json(serde_json::json!({
        "ok": true,
        "user_id": user_id,
        "tenant_id": tenant_id,
        "tenant_role": tenant_role,
        "app_memberships_created": app_defaults.len(),
    })))
}

async fn whoami(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if state.db.is_none() {
        return identity_whoami(&state, &headers).await;
    }

    let db = state.db.as_ref().expect("checked is_some");
    let mut user_id: Option<String> = None;

    if state.auth_provider_mode != "compat" {
        if let Some(token) = authorization_bearer_token(&headers) {
            let Some(identity) = resolve_jwt_identity(&state, &token).await else {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({ "error": "Unauthorized: invalid Bearer token" })),
                ));
            };
            let AuthIdentity::Jwt(verified) = identity else {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({ "error": "Unauthorized: JWT required" })),
                ));
            };
            let Some(sub) = verified.sub() else {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({ "error": "Unauthorized: JWT missing sub claim" })),
                ));
            };
            user_id = Some(sub.to_string());
        }
    }

    if user_id.is_none() {
        user_id = header_value(&headers, "x-logline-token")
            .or_else(|| header_value(&headers, "x-user-id"));
    }

    let Some(user_id) = user_id else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized: no valid credential provided" })),
        ));
    };

    let user_rows = db
        .query(
            "select user_id, email, display_name from users where user_id = $1 limit 1",
            &[&user_id],
        )
        .await
        .map_err(db_query_error)?;

    if user_rows.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "User not found", "user_id": user_id })),
        ));
    }

    let user = &user_rows[0];
    let email: Option<String> = user.get("email");
    let display_name: Option<String> = user.get("display_name");

    let tenant_rows = db
        .query(
            "select tenant_id, role from tenant_memberships where user_id = $1",
            &[&user_id],
        )
        .await
        .map_err(db_query_error)?;

    let app_rows = db
        .query(
            "select app_id, tenant_id, role from app_memberships where user_id = $1",
            &[&user_id],
        )
        .await
        .map_err(db_query_error)?;

    let capability_rows = db
        .query(
            "select capability from user_capabilities where user_id = $1",
            &[&user_id],
        )
        .await
        .map_err(db_query_error)?;

    let tenant_memberships: Vec<serde_json::Value> = tenant_rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "tenant_id": row.get::<_, String>("tenant_id"),
                "role": row.get::<_, String>("role"),
            })
        })
        .collect();

    let app_memberships: Vec<serde_json::Value> = app_rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "app_id": row.get::<_, String>("app_id"),
                "tenant_id": row.get::<_, String>("tenant_id"),
                "role": row.get::<_, String>("role"),
            })
        })
        .collect();

    let capabilities: Vec<String> = capability_rows
        .iter()
        .map(|row| row.get::<_, String>("capability"))
        .collect();

    Ok(Json(serde_json::json!({
        "user_id": user_id,
        "email": email,
        "display_name": display_name,
        "tenant_memberships": tenant_memberships,
        "app_memberships": app_memberships,
        "capabilities": capabilities,
    })))
}

async fn require_verified_jwt(
    state: &AppState,
    headers: &axum::http::HeaderMap,
) -> Result<(String, VerifiedJwt), (StatusCode, Json<serde_json::Value>)> {
    if state.jwt_auth.is_none() {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "JWT auth is not configured" })),
        ));
    }

    let Some(token) = authorization_bearer_token(headers) else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Authorization required" })),
        ));
    };

    let Some(identity) = resolve_jwt_identity(state, &token).await else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized: invalid Bearer token" })),
        ));
    };

    let AuthIdentity::Jwt(verified) = identity else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized: JWT required" })),
        ));
    };

    Ok((token, verified))
}

async fn require_founder_user(
    state: &AppState,
    headers: &axum::http::HeaderMap,
) -> Result<String, (StatusCode, Json<serde_json::Value>)> {
    let (_token, verified) = require_verified_jwt(state, headers).await?;
    let Some(user_id) = verified.sub().map(ToString::to_string) else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized: JWT missing sub claim" })),
        ));
    };

    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let cap_rows = db
        .query(
            "select 1 from user_capabilities where user_id = $1 and capability = 'founder' limit 1",
            &[&user_id],
        )
        .await
        .map_err(db_query_error)?;
    if cap_rows.is_empty() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "founder capability required" })),
        ));
    }

    Ok(user_id)
}

async fn create_cli_auth_challenge(
    State(state): State<AppState>,
    body_bytes: axum::body::Bytes,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let maybe_payload = if body_bytes.is_empty() {
        None
    } else {
        let body_text = std::str::from_utf8(&body_bytes).map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid request body" })),
            )
        })?;
        if body_text.trim().is_empty() {
            None
        } else {
            Some(serde_json::from_str::<CreateCliChallengeRequest>(body_text).map_err(
                |_| {
                    (
                        StatusCode::BAD_REQUEST,
                        Json(serde_json::json!({ "error": "Invalid request body" })),
                    )
                },
            )?)
        }
    };

    let device_name = maybe_payload
        .and_then(|payload| payload.device_name)
        .and_then(|name| {
            let trimmed = name.trim().to_string();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed)
            }
        });
    if device_name
        .as_ref()
        .is_some_and(|value| value.chars().count() > 128)
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }

    let nonce = hex::encode(rand::random::<[u8; 16]>());

    let rows = db
        .query(
            "insert into cli_auth_challenges (nonce, status, device_name, expires_at, created_at) \
             values ($1, 'pending', $2, now() + interval '5 minutes', now()) \
             returning challenge_id, to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as expires_at_iso",
            &[&nonce, &device_name],
        )
        .await
        .map_err(db_query_error)?;

    let challenge = &rows[0];
    let challenge_id: String = challenge.get("challenge_id");
    let expires_at: String = challenge.get("expires_at_iso");
    let app_url = std::env::var("APP_URL").unwrap_or_else(|_| "http://127.0.0.1:3000".to_string());
    let challenge_url = format!(
        "{}/cli-login?challenge={challenge_id}&nonce={nonce}",
        app_url.trim_end_matches('/')
    );

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "challenge_id": challenge_id,
            "nonce": nonce,
            "expires_at": expires_at,
            "challenge_url": challenge_url,
        })),
    ))
}

async fn cli_auth_challenge_status(
    State(state): State<AppState>,
    Path(path): Path<ChallengePath>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let rows = db
        .query(
            "select challenge_id, status, session_token, user_id, tenant_id, \
                to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as expires_at_iso, \
                to_char(approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as approved_at_iso, \
                expires_at < now() as is_expired \
             from cli_auth_challenges where challenge_id = $1 limit 1",
            &[&path.challenge_id],
        )
        .await
        .map_err(db_query_error)?;

    if rows.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Challenge not found" })),
        ));
    }

    let row = &rows[0];
    let mut status: String = row.get("status");
    let is_expired: bool = row.get("is_expired");

    if status == "pending" && is_expired {
        db.execute(
            "update cli_auth_challenges set status = 'expired' where challenge_id = $1",
            &[&path.challenge_id],
        )
        .await
        .map_err(db_query_error)?;

        status = "expired".to_string();
        return Ok(Json(serde_json::json!({
            "challenge_id": path.challenge_id,
            "status": status,
        })));
    }

    let mut value = serde_json::json!({
        "challenge_id": row.get::<_, String>("challenge_id"),
        "status": status,
        "expires_at": row.get::<_, String>("expires_at_iso"),
    });

    if value["status"] == "approved" {
        value["session_token"] = row
            .get::<_, Option<String>>("session_token")
            .map(Value::String)
            .unwrap_or(Value::Null);
        value["user_id"] = row
            .get::<_, Option<String>>("user_id")
            .map(Value::String)
            .unwrap_or(Value::Null);
        value["tenant_id"] = row
            .get::<_, Option<String>>("tenant_id")
            .map(Value::String)
            .unwrap_or(Value::Null);
        value["approved_at"] = row
            .get::<_, Option<String>>("approved_at_iso")
            .map(Value::String)
            .unwrap_or(Value::Null);
    }

    Ok(Json(value))
}

async fn cli_auth_challenge_approve(
    State(state): State<AppState>,
    Path(path): Path<ChallengePath>,
    headers: axum::http::HeaderMap,
    Json(body): Json<ApproveCliChallengeRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let action = body.action.trim();
    if action != "approve" && action != "deny" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }

    let (token, verified) = require_verified_jwt(&state, &headers).await?;
    let Some(user_id) = verified.sub().map(ToString::to_string) else {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Unauthorized: JWT missing sub claim" })),
        ));
    };
    let workspace_id = verified
        .claim("workspace_id")
        .and_then(|value| value.as_str())
        .map(ToString::to_string);

    let rows = db
        .query(
            "select status, expires_at < now() as is_expired from cli_auth_challenges where challenge_id = $1 limit 1",
            &[&path.challenge_id],
        )
        .await
        .map_err(db_query_error)?;
    if rows.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Challenge not found" })),
        ));
    }

    let status: String = rows[0].get("status");
    let is_expired: bool = rows[0].get("is_expired");

    if status != "pending" {
        return Err((
            StatusCode::CONFLICT,
            Json(serde_json::json!({ "error": format!("Challenge is already {status}") })),
        ));
    }
    if is_expired {
        db.execute(
            "update cli_auth_challenges set status = 'expired' where challenge_id = $1",
            &[&path.challenge_id],
        )
        .await
        .map_err(db_query_error)?;
        return Err((
            StatusCode::GONE,
            Json(serde_json::json!({ "error": "Challenge has expired" })),
        ));
    }

    if action == "deny" {
        db.execute(
            "update cli_auth_challenges set status = 'denied', user_id = $1 where challenge_id = $2",
            &[&user_id, &path.challenge_id],
        )
        .await
        .map_err(db_query_error)?;
        return Ok(Json(serde_json::json!({ "ok": true, "status": "denied" })));
    }

    db.execute(
        "update cli_auth_challenges \
         set status = 'approved', user_id = $1, tenant_id = $2, session_token = $3, approved_at = now() \
         where challenge_id = $4",
        &[&user_id, &workspace_id, &token, &path.challenge_id],
    )
    .await
    .map_err(db_query_error)?;

    Ok(Json(serde_json::json!({
        "ok": true,
        "status": "approved",
        "challenge_id": path.challenge_id,
    })))
}

async fn founder_keys_register(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<FounderKeyRegisterRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_founder_user(&state, &headers).await?;
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let public_key = body.public_key.trim().to_string();
    if public_key.len() < 32 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }
    let algorithm = body.algorithm.unwrap_or_else(|| "ed25519".to_string());
    if algorithm != "ed25519" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }

    let rows = db
        .query(
            "insert into founder_signing_keys (user_id, public_key, algorithm, status, created_at) \
             values ($1, $2, $3, 'active', now()) \
             returning key_id",
            &[&user_id, &public_key, &algorithm],
        )
        .await
        .map_err(db_query_error)?;

    let key_id: String = rows[0].get("key_id");
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "key_id": key_id, "ok": true })),
    ))
}

fn canonical_intent_payload(body: &FounderIntentVerifyRequest) -> String {
    format!(
        "{{\"nonce\":{},\"expires_at\":{},\"payload\":{}}}",
        serde_json::to_string(&body.nonce).unwrap_or_else(|_| "\"\"".to_string()),
        serde_json::to_string(&body.expires_at).unwrap_or_else(|_| "\"\"".to_string()),
        body.payload
    )
}

fn verify_ed25519(public_key_hex: &str, message: &str, signature_b64: &str) -> bool {
    let Ok(public_key) = hex::decode(public_key_hex) else {
        return false;
    };
    if public_key.len() != 32 {
        return false;
    }
    let Ok(signature_raw) = base64::engine::general_purpose::STANDARD.decode(signature_b64) else {
        return false;
    };
    if signature_raw.len() != 64 {
        return false;
    }

    let verifier = signature::UnparsedPublicKey::new(&signature::ED25519, public_key);
    verifier.verify(message.as_bytes(), &signature_raw).is_ok()
}

async fn record_protected_audit(
    db: &PgClient,
    user_id: &str,
    intent_id: Option<&str>,
    action_type: &str,
    decision: &str,
    deny_reason: Option<&str>,
    execution_result: Option<&str>,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    db.execute(
        "insert into protected_action_audit \
         (actor_user_id, intent_id, action_type, decision, deny_reason, execution_result, recorded_at) \
         values ($1, $2, $3, $4, $5, $6, now())",
        &[&user_id, &intent_id, &action_type, &decision, &deny_reason, &execution_result],
    )
    .await
    .map_err(db_query_error)?;
    Ok(())
}

async fn founder_intents_verify(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<FounderIntentVerifyRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_founder_user(&state, &headers).await?;
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    if body.signing_key_id.trim().is_empty()
        || body.nonce.len() < 16
        || body.nonce.len() > 128
        || body.signature.trim().is_empty()
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }

    let expired = match db
        .query_one("select ($1::timestamptz < now()) as expired", &[&body.expires_at])
        .await
    {
        Ok(row) => row.get::<_, bool>("expired"),
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid request body" })),
            ));
        }
    };
    if expired {
        record_protected_audit(
            db,
            &user_id,
            None,
            "intent_verify",
            "denied",
            Some("intent expired"),
            None,
        )
        .await?;
        return Err((
            StatusCode::GONE,
            Json(serde_json::json!({ "error": "Intent has expired" })),
        ));
    }

    let nonce_rows = db
        .query(
            "select intent_id from protected_intents where nonce = $1 limit 1",
            &[&body.nonce],
        )
        .await
        .map_err(db_query_error)?;
    if !nonce_rows.is_empty() {
        record_protected_audit(
            db,
            &user_id,
            None,
            "intent_verify",
            "denied",
            Some("nonce replay"),
            None,
        )
        .await?;
        return Err((
            StatusCode::CONFLICT,
            Json(serde_json::json!({ "error": "Nonce already used" })),
        ));
    }

    let key_rows = db
        .query(
            "select public_key, algorithm from founder_signing_keys \
             where key_id = $1 and user_id = $2 and status = 'active' limit 1",
            &[&body.signing_key_id, &user_id],
        )
        .await
        .map_err(db_query_error)?;
    if key_rows.is_empty() {
        record_protected_audit(
            db,
            &user_id,
            None,
            "intent_verify",
            "denied",
            Some("signing key not found or revoked"),
            None,
        )
        .await?;
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Signing key not found or revoked" })),
        ));
    }

    let public_key: String = key_rows[0].get("public_key");
    let algorithm: String = key_rows[0].get("algorithm");
    if algorithm != "ed25519" {
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": "Unsupported signing algorithm" })),
        ));
    }

    let canonical = canonical_intent_payload(&body);
    let payload_hash = hex::encode(digest::digest(&digest::SHA256, canonical.as_bytes()).as_ref());
    let sig_valid = verify_ed25519(&public_key, &canonical, &body.signature);
    if !sig_valid {
        record_protected_audit(
            db,
            &user_id,
            None,
            "intent_verify",
            "denied",
            Some("signature invalid"),
            None,
        )
        .await?;
        return Err((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({ "error": "Signature verification failed" })),
        ));
    }

    let intent_rows = db
        .query(
            "insert into protected_intents \
             (actor_user_id, tenant_id, app_id, nonce, payload_hash, signing_key_id, signature, expires_at, verification_status, verified_at, created_at) \
             values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, 'verified', now(), now()) \
             returning intent_id",
            &[&user_id, &body.tenant_id, &body.app_id, &body.nonce, &payload_hash, &body.signing_key_id, &body.signature, &body.expires_at],
        )
        .await
        .map_err(db_query_error)?;

    let intent_id: String = intent_rows[0].get("intent_id");
    record_protected_audit(
        db,
        &user_id,
        Some(&intent_id),
        "intent_verify",
        "allowed",
        None,
        None,
    )
    .await?;

    Ok(Json(serde_json::json!({
        "ok": true,
        "intent_id": intent_id,
        "status": "verified",
    })))
}

async fn founder_actions_execute(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(body): Json<FounderActionExecuteRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_founder_user(&state, &headers).await?;
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    if body.intent_id.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }

    let intent_rows = db
        .query(
            "select intent_id, verification_status, expires_at < now() as is_expired \
             from protected_intents where intent_id = $1 and actor_user_id = $2 limit 1",
            &[&body.intent_id, &user_id],
        )
        .await
        .map_err(db_query_error)?;
    if intent_rows.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Intent not found" })),
        ));
    }
    let row = &intent_rows[0];
    let verification_status: String = row.get("verification_status");
    let is_expired: bool = row.get("is_expired");

    if verification_status != "verified" {
        record_protected_audit(
            db,
            &user_id,
            Some(&body.intent_id),
            "intent_execute",
            "denied",
            Some(&format!("intent status: {verification_status}")),
            None,
        )
        .await?;
        return Err((
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "error": format!("Intent is not verified (status: {verification_status})")
            })),
        ));
    }

    if is_expired {
        record_protected_audit(
            db,
            &user_id,
            Some(&body.intent_id),
            "intent_execute",
            "denied",
            Some("intent expired"),
            None,
        )
        .await?;
        return Err((
            StatusCode::GONE,
            Json(serde_json::json!({ "error": "Intent has expired" })),
        ));
    }

    record_protected_audit(
        db,
        &user_id,
        Some(&body.intent_id),
        "intent_execute",
        "allowed",
        None,
        Some("dispatched"),
    )
    .await?;

    Ok(Json(serde_json::json!({
        "ok": true,
        "intent_id": body.intent_id,
        "status": "dispatched",
    })))
}

#[derive(Debug)]
struct AppAccessContext {
    workspace_id: String,
    tenant_id: String,
    app_id: String,
    user_id: String,
}

#[derive(Debug, Clone, Copy)]
enum AccessPermission {
    Read,
    Write,
    PrivateRead,
}

async fn ensure_local_dev_bootstrap(
    state: &AppState,
    tenant_id: &str,
    app_id: &str,
    user_id: &str,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Ok(());
    };

    let rbac_strict = std::env::var("RBAC_STRICT")
        .ok()
        .map(|value| value.trim() == "1")
        .unwrap_or(false);
    if rbac_strict {
        return Ok(());
    }

    let default_user_id = std::env::var("DEFAULT_USER_ID").unwrap_or_else(|_| "local-dev".to_string());
    if user_id != default_user_id {
        return Ok(());
    }

    db.execute(
        "insert into users (user_id, display_name, created_at) values ($1, 'Local Dev', now()) on conflict do nothing",
        &[&user_id],
    )
    .await
    .map_err(db_query_error)?;

    db.execute(
        "insert into tenants (tenant_id, slug, name, created_at) values ($1, $1, $1, now()) on conflict do nothing",
        &[&tenant_id],
    )
    .await
    .map_err(db_query_error)?;

    db.execute(
        "insert into apps (app_id, tenant_id, name, created_at) values ($1, $2, $1, now()) on conflict do nothing",
        &[&app_id, &tenant_id],
    )
    .await
    .map_err(db_query_error)?;

    db.execute(
        "insert into tenant_memberships (tenant_id, user_id, role, created_at) values ($1, $2, 'admin', now()) on conflict do nothing",
        &[&tenant_id, &user_id],
    )
    .await
    .map_err(db_query_error)?;

    db.execute(
        "insert into app_memberships (app_id, tenant_id, user_id, role, created_at) values ($1, $2, $3, 'app_admin', now()) on conflict do nothing",
        &[&app_id, &tenant_id, &user_id],
    )
    .await
    .map_err(db_query_error)?;

    Ok(())
}

fn query_field(value: Option<&String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

async fn resolve_access_context(
    state: &AppState,
    headers: &axum::http::HeaderMap,
    scope: Option<&ScopeQuery>,
    permission: AccessPermission,
    app_id_path: Option<&str>,
) -> Result<AppAccessContext, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let rbac_strict = std::env::var("RBAC_STRICT")
        .ok()
        .map(|value| value.trim() == "1")
        .unwrap_or(false);
    let default_workspace_id =
        std::env::var("DEFAULT_WORKSPACE_ID").unwrap_or_else(|_| "default".to_string());
    let default_app_id = std::env::var("DEFAULT_APP_ID").unwrap_or_else(|_| "ublx".to_string());
    let default_user_id =
        std::env::var("DEFAULT_USER_ID").unwrap_or_else(|_| "local-dev".to_string());

    let mut user_id: Option<String> = None;
    let mut jwt_workspace_id: Option<String> = None;
    let mut jwt_app_id: Option<String> = None;

    if state.auth_provider_mode != "compat" {
        if let Some(token) = authorization_bearer_token(headers) {
            let Some(identity) = resolve_jwt_identity(state, &token).await else {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({ "error": "Unauthorized: invalid Bearer token" })),
                ));
            };
            let AuthIdentity::Jwt(verified) = identity else {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({ "error": "Unauthorized: JWT required" })),
                ));
            };

            let Some(sub) = verified.sub() else {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({ "error": "Unauthorized: JWT missing sub claim" })),
                ));
            };
            user_id = Some(sub.to_string());
            jwt_workspace_id = verified
                .claim("workspace_id")
                .and_then(|value| value.as_str())
                .map(ToString::to_string);
            jwt_app_id = verified
                .claim("app_id")
                .and_then(|value| value.as_str())
                .map(ToString::to_string);
        } else if rbac_strict {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Authorization header with Bearer token required" })),
            ));
        }
    }

    let user_id = user_id
        .or_else(|| header_value(headers, "x-user-id"))
        .or_else(|| query_field(scope.and_then(|s| s.user_id.as_ref())))
        .or_else(|| header_value(headers, "x-logline-token"))
        .unwrap_or(default_user_id);

    let mut workspace_id = header_value(headers, "x-workspace-id")
        .or_else(|| query_field(scope.and_then(|s| s.workspace_id.as_ref())))
        .unwrap_or_else(|| default_workspace_id.clone());
    if let Some(jwt_workspace) = jwt_workspace_id {
        if workspace_id == default_workspace_id {
            workspace_id = jwt_workspace;
        }
    }
    let tenant_id = workspace_id.clone();

    let mut app_id = header_value(headers, "x-app-id")
        .or_else(|| query_field(scope.and_then(|s| s.app_id.as_ref())))
        .unwrap_or_else(|| default_app_id.clone());
    if let Some(jwt_app) = jwt_app_id {
        if app_id == default_app_id {
            app_id = jwt_app;
        }
    }
    if let Some(path_app_id) = app_id_path {
        if app_id != path_app_id {
            return Err((
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({ "error": "App scope mismatch" })),
            ));
        }
    }

    ensure_local_dev_bootstrap(state, &tenant_id, &app_id, &user_id).await?;

    let tenant_membership_count = db
        .query_one(
            "select count(*)::int as count from tenant_memberships where user_id = $1",
            &[&user_id],
        )
        .await
        .map_err(db_query_error)?
        .get::<_, i32>("count");
    if tenant_membership_count <= 0 {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "User must belong to at least one tenant" })),
        ));
    }

    let tenant_rows = db
        .query(
            "select role from tenant_memberships where tenant_id = $1 and user_id = $2 limit 1",
            &[&tenant_id, &user_id],
        )
        .await
        .map_err(db_query_error)?;
    if tenant_rows.is_empty() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "User is not a member of this tenant" })),
        ));
    }

    let app_rows = db
        .query(
            "select role from app_memberships where app_id = $1 and tenant_id = $2 and user_id = $3 limit 1",
            &[&app_id, &tenant_id, &user_id],
        )
        .await
        .map_err(db_query_error)?;
    if app_rows.is_empty() {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "User is not a member of this app" })),
        ));
    }
    let app_role: String = app_rows[0].get("role");

    if matches!(
        permission,
        AccessPermission::Write | AccessPermission::PrivateRead
    ) && app_role != "app_admin"
    {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "error": if matches!(permission, AccessPermission::PrivateRead) {
                    "Private data is only available to app admins"
                } else {
                    "Members cannot change tenant/app data"
                }
            })),
        ));
    }

    Ok(AppAccessContext {
        workspace_id,
        tenant_id,
        app_id,
        user_id,
    })
}

async fn resolve_app_access_context(
    state: &AppState,
    headers: &axum::http::HeaderMap,
    app_id_path: &str,
) -> Result<AppAccessContext, (StatusCode, Json<serde_json::Value>)> {
    resolve_access_context(
        state,
        headers,
        None,
        AccessPermission::Read,
        Some(app_id_path),
    )
    .await
}

async fn list_user_keys(
    State(state): State<AppState>,
    Path(path): Path<AppKeyPath>,
    headers: axum::http::HeaderMap,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access = resolve_app_access_context(&state, &headers, &path.app_id).await?;

    let rows = db
        .query(
            "select key_id, provider, key_label, metadata::text as metadata_text, \
                to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at_iso \
             from user_provider_keys \
             where tenant_id = $1 and app_id = $2 and user_id = $3 \
             order by created_at asc",
            &[&access.tenant_id, &access.app_id, &access.user_id],
        )
        .await
        .map_err(db_query_error)?;

    let items: Vec<Value> = rows
        .iter()
        .map(|row| {
            let metadata_text: String = row.get("metadata_text");
            let metadata = serde_json::from_str::<Value>(&metadata_text).unwrap_or(Value::Null);
            serde_json::json!({
                "key_id": row.get::<_, String>("key_id"),
                "provider": row.get::<_, String>("provider"),
                "key_label": row.get::<_, String>("key_label"),
                "metadata": metadata,
                "created_at": row.get::<_, String>("created_at_iso"),
            })
        })
        .collect();

    Ok(Json(Value::Array(items)))
}

async fn add_user_key(
    State(state): State<AppState>,
    Path(path): Path<AppKeyPath>,
    headers: axum::http::HeaderMap,
    Json(body): Json<AddUserKeyRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access = resolve_app_access_context(&state, &headers, &path.app_id).await?;

    let provider = body.provider.trim().to_string();
    let key_label = body.key_label.trim().to_string();
    let encrypted_key = body.encrypted_key.trim().to_string();
    if provider.is_empty() || provider.len() > 64 || key_label.is_empty() || key_label.len() > 128 || encrypted_key.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }
    let metadata = body.metadata.unwrap_or_else(|| serde_json::json!({}));
    let metadata_text = serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string());

    let rows = db
        .query(
            "insert into user_provider_keys \
             (tenant_id, app_id, user_id, provider, key_label, encrypted_key, metadata, created_at, updated_at) \
             values ($1, $2, $3, $4, $5, $6, $7::jsonb, now(), now()) \
             returning key_id",
            &[&access.tenant_id, &access.app_id, &access.user_id, &provider, &key_label, &encrypted_key, &metadata_text],
        )
        .await;

    let rows = match rows {
        Ok(rows) => rows,
        Err(err) => {
            if err
                .code()
                .is_some_and(|code| code.code() == "23505")
            {
                return Err((
                    StatusCode::CONFLICT,
                    Json(serde_json::json!({ "error": "Key label already exists for this provider" })),
                ));
            }
            return Err(db_query_error(err));
        }
    };

    let key_id: String = rows[0].get("key_id");
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "key_id": key_id, "ok": true })),
    ))
}

fn to_i32(value: Option<i64>) -> Result<Option<i32>, (StatusCode, Json<serde_json::Value>)> {
    match value {
        None => Ok(None),
        Some(v) => i32::try_from(v).map(Some).map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({ "error": "Invalid request body" })),
            )
        }),
    }
}

async fn list_installed_components(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&scope), AccessPermission::Read, None).await?;
    let prefix = format!("{}:{}::", access.workspace_id, access.app_id);
    let like_pattern = format!("{prefix}%");

    let rows = db
        .query(
            "select component_id, \
                to_char(installed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as installed_at_iso \
             from installed_components \
             where component_id like $1 \
             order by installed_at asc",
            &[&like_pattern],
        )
        .await
        .map_err(db_query_error)?;

    let items: Vec<Value> = rows
        .iter()
        .map(|row| {
            let full_component_id: String = row.get("component_id");
            let short_component_id = full_component_id
                .strip_prefix(&prefix)
                .unwrap_or(&full_component_id)
                .to_string();
            serde_json::json!({
                "component_id": short_component_id,
                "installed_at": row.get::<_, String>("installed_at_iso"),
            })
        })
        .collect();

    Ok(Json(Value::Array(items)))
}

async fn add_installed_component(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
    Json(body): Json<InstalledComponentBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&scope), AccessPermission::Write, None).await?;

    let component_id = body.component_id.trim().to_string();
    if component_id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }

    let scoped_component_id = format!("{}:{}::{component_id}", access.workspace_id, access.app_id);
    let rows = db
        .query(
            "insert into installed_components (component_id, installed_at) \
             values ($1, now()) \
             on conflict (component_id) do update set installed_at = excluded.installed_at \
             returning to_char(installed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as installed_at_iso",
            &[&scoped_component_id],
        )
        .await
        .map_err(db_query_error)?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "component_id": component_id,
            "installed_at": rows[0].get::<_, String>("installed_at_iso"),
        })),
    ))
}

async fn remove_installed_component(
    State(state): State<AppState>,
    Path(path): Path<InstalledComponentPath>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&scope), AccessPermission::Write, None).await?;
    let component_id = path.component_id.trim();
    if component_id.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request path" })),
        ));
    }
    let scoped_component_id = format!("{}:{}::{component_id}", access.workspace_id, access.app_id);
    db.execute(
        "delete from installed_components where component_id = $1",
        &[&scoped_component_id],
    )
    .await
    .map_err(db_query_error)?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn get_settings(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access = resolve_access_context(
        &state,
        &headers,
        Some(&scope),
        AccessPermission::PrivateRead,
        None,
    )
    .await?;

    let prefix = format!("ws:{}:app:{}:", access.workspace_id, access.app_id);
    let like_pattern = format!("{prefix}%");
    let legacy_prefix = format!("ws:{}:", access.workspace_id);
    let legacy_key = format!("{}component_defaults", legacy_prefix);

    let rows = db
        .query(
            "select key, value from app_settings where key like $1",
            &[&like_pattern],
        )
        .await
        .map_err(db_query_error)?;
    let legacy_rows = db
        .query(
            "select key, value from app_settings where key = $1",
            &[&legacy_key],
        )
        .await
        .map_err(db_query_error)?;

    let mut out = serde_json::Map::new();
    for row in legacy_rows.iter().chain(rows.iter()) {
        let key: String = row.get("key");
        let value_text: String = row.get("value");
        let raw_key = if key.starts_with(&prefix) {
            key[prefix.len()..].to_string()
        } else if key.starts_with(&legacy_prefix) {
            key[legacy_prefix.len()..].to_string()
        } else {
            continue;
        };
        let parsed = serde_json::from_str::<Value>(&value_text).unwrap_or(Value::Null);
        out.insert(raw_key, parsed);
    }

    Ok(Json(Value::Object(out)))
}

async fn patch_settings(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
    Json(body): Json<SettingsPatchBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&scope), AccessPermission::Write, None).await?;
    let key = body.key.trim().to_string();
    if key.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }

    let scoped_key = format!("ws:{}:app:{}:{key}", access.workspace_id, access.app_id);
    let value_text = serde_json::to_string(&body.value).unwrap_or_else(|_| "null".to_string());
    db.execute(
        "insert into app_settings (key, value, updated_at) values ($1, $2, now()) \
         on conflict (key) do update set value = excluded.value, updated_at = now()",
        &[&scoped_key, &value_text],
    )
    .await
    .map_err(db_query_error)?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn get_status_log(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Query(query): Query<StatusLogQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&query.scope), AccessPermission::Read, None)
            .await?;
    let limit = query.limit.unwrap_or(50).clamp(1, 500);

    let rows = db
        .query(
            "select id, workspace_id, app_id, service_name, status, latency_ms, \
                to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as recorded_at_iso \
             from service_status_log \
             where workspace_id = $1 and app_id = $2 \
             order by recorded_at desc \
             limit $3",
            &[&access.workspace_id, &access.app_id, &limit],
        )
        .await
        .map_err(db_query_error)?;

    let items: Vec<Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<_, i32>("id"),
                "workspace_id": row.get::<_, String>("workspace_id"),
                "app_id": row.get::<_, String>("app_id"),
                "service_name": row.get::<_, String>("service_name"),
                "status": row.get::<_, String>("status"),
                "latency_ms": row.get::<_, Option<i32>>("latency_ms"),
                "recorded_at": row.get::<_, String>("recorded_at_iso"),
            })
        })
        .collect();

    Ok(Json(Value::Array(items)))
}

async fn post_status_log(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
    Json(body): Json<StatusLogBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&scope), AccessPermission::Write, None).await?;
    let service_name = body.service_name.trim().to_string();
    let status = body.status.trim().to_string();
    if service_name.is_empty() || status.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }
    let latency_ms = to_i32(body.latency_ms)?;

    db.execute(
        "insert into service_status_log (workspace_id, app_id, service_name, status, latency_ms, recorded_at) \
         values ($1, $2, $3, $4, $5, now())",
        &[&access.workspace_id, &access.app_id, &service_name, &status, &latency_ms],
    )
    .await
    .map_err(db_query_error)?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "ok": true }))))
}

async fn get_chat_messages(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Query(query): Query<ChatQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let session_id = query
        .session_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string);
    let Some(session_id) = session_id else {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "session_id required" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&query.scope), AccessPermission::Read, None)
            .await?;

    let rows = db
        .query(
            "select id, workspace_id, app_id, session_id, panel_id, instance_id, role, content, model_used, latency_ms, \
                to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at_iso \
             from chat_messages \
             where workspace_id = $1 and app_id = $2 and session_id = $3 \
             order by created_at asc",
            &[&access.workspace_id, &access.app_id, &session_id],
        )
        .await
        .map_err(db_query_error)?;

    let items: Vec<Value> = rows
        .iter()
        .map(|row| {
            serde_json::json!({
                "id": row.get::<_, String>("id"),
                "workspace_id": row.get::<_, String>("workspace_id"),
                "app_id": row.get::<_, String>("app_id"),
                "session_id": row.get::<_, String>("session_id"),
                "panel_id": row.get::<_, Option<String>>("panel_id"),
                "instance_id": row.get::<_, Option<String>>("instance_id"),
                "role": row.get::<_, String>("role"),
                "content": row.get::<_, String>("content"),
                "model_used": row.get::<_, Option<String>>("model_used"),
                "latency_ms": row.get::<_, Option<i32>>("latency_ms"),
                "created_at": row.get::<_, String>("created_at_iso"),
            })
        })
        .collect();

    Ok(Json(Value::Array(items)))
}

async fn post_chat_message(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
    Json(body): Json<ChatBody>,
) -> Result<(StatusCode, Json<serde_json::Value>), (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&scope), AccessPermission::Write, None).await?;
    let session_id = body.session_id.trim().to_string();
    let role = body.role.trim().to_string();
    let content = body.content.to_string();
    if session_id.is_empty() || role.is_empty() || content.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Invalid request body" })),
        ));
    }
    let latency_ms = to_i32(body.latency_ms)?;
    let panel_id = body
        .panel_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string);
    let instance_id = body
        .instance_id
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string);
    let model_used = body
        .model_used
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToString::to_string);

    let id = format!("msg_{}", hex::encode(rand::random::<[u8; 16]>()));
    let rows = db
        .query(
            "insert into chat_messages \
             (id, workspace_id, app_id, session_id, panel_id, instance_id, role, content, model_used, latency_ms, created_at) \
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now()) \
             returning to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as created_at_iso",
            &[&id, &access.workspace_id, &access.app_id, &session_id, &panel_id, &instance_id, &role, &content, &model_used, &latency_ms],
        )
        .await
        .map_err(db_query_error)?;
    let created_at: String = rows[0].get("created_at_iso");

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "id": id,
            "workspace_id": access.workspace_id,
            "app_id": access.app_id,
            "session_id": session_id,
            "panel_id": panel_id,
            "instance_id": instance_id,
            "role": role,
            "content": content,
            "model_used": model_used,
            "latency_ms": latency_ms,
            "created_at": created_at,
        })),
    ))
}

async fn get_instance_config(
    State(state): State<AppState>,
    Path(path): Path<InstanceConfigPath>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access = resolve_access_context(
        &state,
        &headers,
        Some(&scope),
        AccessPermission::PrivateRead,
        None,
    )
    .await?;

    let ownership_rows = db
        .query(
            "select pc.instance_id \
             from panel_components pc \
             inner join panels p on p.panel_id = pc.panel_id \
             where pc.instance_id = $1 and p.workspace_id = $2 and p.app_id = $3 \
             limit 1",
            &[&path.instance_id, &access.workspace_id, &access.app_id],
        )
        .await
        .map_err(db_query_error)?;
    if ownership_rows.is_empty() {
        return Ok(Json(Value::Null));
    }

    let rows = db
        .query(
            "select instance_id, source_hub, source_origin, source_auth_ref, source_mode, source_interval_ms, \
                proc_executor, proc_command, proc_args, proc_timeout_ms, proc_retries, proc_backoff, proc_error_mode, \
                to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as updated_at_iso \
             from instance_configs where instance_id = $1 limit 1",
            &[&path.instance_id],
        )
        .await
        .map_err(db_query_error)?;
    let Some(row) = rows.first() else {
        return Ok(Json(Value::Null));
    };

    let proc_args_text: Option<String> = row.get("proc_args");
    let proc_args = proc_args_text
        .as_deref()
        .and_then(|text| serde_json::from_str::<Value>(text).ok())
        .unwrap_or_else(|| serde_json::json!([]));

    Ok(Json(serde_json::json!({
        "instance_id": row.get::<_, String>("instance_id"),
        "source_hub": row.get::<_, Option<String>>("source_hub"),
        "source_origin": row.get::<_, Option<String>>("source_origin"),
        "source_auth_ref": row.get::<_, Option<String>>("source_auth_ref"),
        "source_mode": row.get::<_, Option<String>>("source_mode"),
        "source_interval_ms": row.get::<_, Option<i32>>("source_interval_ms"),
        "proc_executor": row.get::<_, Option<String>>("proc_executor"),
        "proc_command": row.get::<_, Option<String>>("proc_command"),
        "proc_args": proc_args,
        "proc_timeout_ms": row.get::<_, Option<i32>>("proc_timeout_ms"),
        "proc_retries": row.get::<_, Option<i32>>("proc_retries"),
        "proc_backoff": row.get::<_, Option<String>>("proc_backoff"),
        "proc_error_mode": row.get::<_, Option<String>>("proc_error_mode"),
        "updated_at": row.get::<_, String>("updated_at_iso"),
    })))
}

async fn upsert_instance_config(
    State(state): State<AppState>,
    Path(path): Path<InstanceConfigPath>,
    headers: axum::http::HeaderMap,
    Query(scope): Query<ScopeQuery>,
    Json(body): Json<InstanceConfigPutBody>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let Some(db) = state.db.as_ref() else {
        return Err((
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "error": "database is not configured" })),
        ));
    };

    let access =
        resolve_access_context(&state, &headers, Some(&scope), AccessPermission::Write, None).await?;

    let ownership_rows = db
        .query(
            "select pc.instance_id \
             from panel_components pc \
             inner join panels p on p.panel_id = pc.panel_id \
             where pc.instance_id = $1 and p.workspace_id = $2 and p.app_id = $3 \
             limit 1",
            &[&path.instance_id, &access.workspace_id, &access.app_id],
        )
        .await
        .map_err(db_query_error)?;
    if ownership_rows.is_empty() {
        return Err((
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Instance not found in workspace" })),
        ));
    }

    let source_interval_ms = to_i32(body.source_interval_ms)?;
    let proc_timeout_ms = to_i32(body.proc_timeout_ms)?;
    let proc_retries = to_i32(body.proc_retries)?;
    let proc_args_text = serde_json::to_string(&body.proc_args.unwrap_or_default())
        .unwrap_or_else(|_| "[]".to_string());

    db.execute(
        "insert into instance_configs \
         (instance_id, source_hub, source_origin, source_auth_ref, source_mode, source_interval_ms, \
          proc_executor, proc_command, proc_args, proc_timeout_ms, proc_retries, proc_backoff, proc_error_mode, updated_at) \
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()) \
         on conflict (instance_id) do update set \
           source_hub = excluded.source_hub, \
           source_origin = excluded.source_origin, \
           source_auth_ref = excluded.source_auth_ref, \
           source_mode = excluded.source_mode, \
           source_interval_ms = excluded.source_interval_ms, \
           proc_executor = excluded.proc_executor, \
           proc_command = excluded.proc_command, \
           proc_args = excluded.proc_args, \
           proc_timeout_ms = excluded.proc_timeout_ms, \
           proc_retries = excluded.proc_retries, \
           proc_backoff = excluded.proc_backoff, \
           proc_error_mode = excluded.proc_error_mode, \
           updated_at = now()",
        &[
            &path.instance_id,
            &body.source_hub,
            &body.source_origin,
            &body.source_auth_ref,
            &body.source_mode,
            &source_interval_ms,
            &body.proc_executor,
            &body.proc_command,
            &proc_args_text,
            &proc_timeout_ms,
            &proc_retries,
            &body.proc_backoff,
            &body.proc_error_mode,
        ],
    )
    .await
    .map_err(db_query_error)?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn status(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    map_result(
        state
            .runtime
            .status()
            .map(|s| serde_json::to_value(s).expect("serializable")),
    )
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
        let mut sessions = auth.sessions.write().map_err(|_| {
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
    let mut sessions = auth.sessions.write().map_err(|_| {
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
    let mut sessions = auth.sessions.write().map_err(|_| {
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
