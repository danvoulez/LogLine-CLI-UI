use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::Duration;

use clap::{Parser, Subcommand};
use logline_api::{Intent, RuntimeEngine};
use logline_core::{
    default_config_dir, demo_catalog, load_catalog_from_dir, write_default_config_files,
};
use logline_runtime::LoglineRuntime;
use qrcode::{QrCode, render::unicode};
use serde::{Deserialize, Serialize};

#[derive(Debug, Parser)]
#[command(name = "logline", about = "Logline CLI (runtime-first scaffold)")]
struct Cli {
    /// Output JSON instead of text
    #[arg(long, global = true)]
    json: bool,

    /// Config directory (contains connections.toml/runtime.toml/ui.toml)
    #[arg(long, global = true)]
    config_dir: Option<PathBuf>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Initialize local config skeleton (placeholder)
    Init {
        #[arg(long)]
        force: bool,
    },
    /// Runtime status
    Status,
    /// Run an intent by type
    Run {
        #[arg(long)]
        intent: String,
        #[arg(long = "arg", value_parser = parse_key_val)]
        args: Vec<(String, String)>,
    },
    /// Stop a running job
    Stop { run_id: String },
    /// Read runtime events
    Events {
        #[arg(long)]
        since: Option<String>,
    },
    /// Profile operations
    Profile {
        #[command(subcommand)]
        command: ProfileCommands,
    },
    /// Backend operations
    Backend {
        #[command(subcommand)]
        command: BackendCommands,
    },
    /// Authentication operations
    Auth {
        #[command(subcommand)]
        command: AuthCommands,
    },
    /// Supabase CLI helper commands (migration/check wrapper)
    Supabase {
        #[command(subcommand)]
        command: SupabaseCommands,
    },
}

#[derive(Debug, Subcommand)]
enum ProfileCommands {
    List,
    Use { profile_id: String },
}

#[derive(Debug, Subcommand)]
enum BackendCommands {
    List,
    Test { backend_id: String },
}

#[derive(Debug, Subcommand)]
enum AuthCommands {
    /// Show identity resolved by daemon for current token
    Whoami {
        /// Daemon base URL, e.g. https://api.logline.world
        #[arg(long)]
        daemon_url: Option<String>,
        /// Auth token (Bearer JWT). If omitted, uses stored token.
        #[arg(long)]
        token: Option<String>,
    },
    /// Login via QR code (scan with authenticated mobile/web session)
    Login {
        /// Daemon base URL, e.g. https://api.logline.world
        #[arg(long)]
        daemon_url: Option<String>,
        /// Use QR code flow
        #[arg(long)]
        qr: bool,
        /// Friendly device name for audit logs
        #[arg(long)]
        device_name: Option<String>,
    },
    /// Resolve tenant metadata before onboarding.
    TenantResolve {
        /// API base URL, e.g. http://localhost:3000
        #[arg(long)]
        daemon_url: Option<String>,
        /// Tenant slug to resolve
        #[arg(long)]
        slug: String,
    },
    /// Claim onboarding membership for an authenticated user.
    OnboardClaim {
        /// API base URL, e.g. http://localhost:3000
        #[arg(long)]
        daemon_url: Option<String>,
        /// Auth token (Bearer JWT). If omitted, uses stored token.
        #[arg(long)]
        token: Option<String>,
        /// Tenant slug to claim
        #[arg(long)]
        tenant_slug: String,
        /// Optional display name to set on first claim
        #[arg(long)]
        display_name: Option<String>,
    },
    /// Founder onboarding helper:
    /// 1) onboard claim, 2) whoami validation, 3) optional founder key register.
    OnboardFounder {
        /// API base URL, e.g. http://localhost:3000
        #[arg(long)]
        daemon_url: Option<String>,
        /// Auth token (Bearer JWT). If omitted, uses stored token.
        #[arg(long)]
        token: Option<String>,
        /// Tenant slug to claim
        #[arg(long)]
        tenant_slug: String,
        /// Optional display name to set on first claim
        #[arg(long)]
        display_name: Option<String>,
        /// Optional founder public key (hex) to register
        #[arg(long)]
        public_key: Option<String>,
        /// Signing key algorithm for founder key registration
        #[arg(long, default_value = "ed25519")]
        algorithm: String,
    },
    /// Show stored auth status
    Status {
        /// Daemon base URL
        #[arg(long)]
        daemon_url: Option<String>,
    },
    /// Remove the stored auth token
    Logout,
}

#[derive(Debug, Subcommand)]
enum SupabaseCommands {
    /// Quick health check (version, projects list, linked migrations)
    Check {
        /// Supabase workdir (where supabase/config.toml lives)
        #[arg(long)]
        workdir: Option<PathBuf>,
    },
    /// List projects in current Supabase account
    Projects {
        /// Supabase workdir (used to load .env token fallback)
        #[arg(long)]
        workdir: Option<PathBuf>,
    },
    /// Link local folder to a Supabase project ref
    Link {
        #[arg(long)]
        project_ref: String,
        /// Supabase workdir (where supabase/config.toml lives)
        #[arg(long)]
        workdir: Option<PathBuf>,
    },
    /// Push pending migrations to linked project
    Migrate {
        /// Supabase workdir (where supabase/config.toml lives)
        #[arg(long)]
        workdir: Option<PathBuf>,
    },
    /// Pass-through command to supabase CLI
    Raw {
        /// Supabase workdir (where supabase/config.toml lives)
        #[arg(long)]
        workdir: Option<PathBuf>,
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },
}

#[derive(Debug, Deserialize)]
struct DaemonError {
    error: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredAuth {
    token: String,
    daemon_url: String,
    user_id: Option<String>,
    email: Option<String>,
    saved_at: u64,
}

#[derive(Debug, Deserialize)]
struct ChallengeResponse {
    challenge_id: String,
    #[allow(dead_code)]
    nonce: String,
    expires_at: String,
    challenge_url: String,
}

#[derive(Debug, Deserialize)]
struct ChallengeStatus {
    status: String,
    session_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WhoamiResponse {
    user_id: String,
    email: Option<String>,
    #[allow(dead_code)]
    display_name: Option<String>,
    #[allow(dead_code)]
    capabilities: Option<Vec<String>>,
}

fn auth_token_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("logline")
        .join("auth.json")
}

fn load_stored_auth() -> Option<StoredAuth> {
    let path = auth_token_path();
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn save_stored_auth(auth: &StoredAuth) -> anyhow::Result<()> {
    let path = auth_token_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&path, serde_json::to_string_pretty(auth)?)?;
    // Restrict to owner-only on Unix.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn delete_stored_auth() -> anyhow::Result<()> {
    let path = auth_token_path();
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

fn render_qr_terminal(url: &str) {
    match QrCode::new(url.as_bytes()) {
        Ok(code) => {
            let image = code
                .render::<unicode::Dense1x2>()
                .dark_color(unicode::Dense1x2::Dark)
                .light_color(unicode::Dense1x2::Light)
                .build();
            println!("\n{image}\n");
        }
        Err(e) => {
            eprintln!("QR render error: {e}");
        }
    }
}

fn now_unix_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn get_hostname() -> String {
    // Try $HOSTNAME env var first (works on most Unix shells).
    if let Ok(h) = std::env::var("HOSTNAME") {
        if !h.is_empty() {
            return h;
        }
    }
    // Fall back to reading /etc/hostname on Linux / uname on macOS.
    if let Ok(h) = fs::read_to_string("/etc/hostname") {
        let trimmed = h.trim().to_string();
        if !trimmed.is_empty() {
            return trimmed;
        }
    }
    "logline-cli".to_string()
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let config_dir = cli.config_dir.clone().unwrap_or_else(default_config_dir);

    let catalog = match load_catalog_from_dir(&config_dir) {
        Ok(c) => c,
        Err(_) => demo_catalog(),
    };
    let runtime = LoglineRuntime::from_catalog(catalog.clone())?;

    match cli.command {
        Commands::Init { force } => {
            if force && config_dir.exists() {
                for name in ["connections.toml", "runtime.toml", "ui.toml"] {
                    let p = config_dir.join(name);
                    if p.exists() {
                        std::fs::remove_file(&p)?;
                    }
                }
            }
            write_default_config_files(&config_dir)?;
            print_json_or_text(
                cli.json,
                serde_json::json!({"message":"init complete","config_dir":config_dir}),
                "Init complete",
            )?;
        }
        Commands::Status => {
            let status = runtime.status()?;
            print_json_or_text(
                cli.json,
                serde_json::to_value(status)?,
                "Runtime status retrieved",
            )?;
        }
        Commands::Run { intent, args } => {
            let payload = BTreeMap::from_iter(args);
            let result = runtime.run_intent(Intent {
                intent_type: intent,
                payload,
            })?;
            print_json_or_text(cli.json, serde_json::to_value(result)?, "Intent accepted")?;
        }
        Commands::Stop { run_id } => {
            runtime.stop_run(run_id.clone())?;
            print_json_or_text(
                cli.json,
                serde_json::json!({"ok":true,"run_id":run_id}),
                "Stop signal sent",
            )?;
        }
        Commands::Events { since } => {
            let events = runtime.events_since(since)?;
            print_json_or_text(cli.json, serde_json::to_value(events)?, "Events fetched")?;
        }
        Commands::Profile { command } => match command {
            ProfileCommands::List => {
                let profiles: Vec<_> = catalog.profiles.keys().cloned().collect();
                print_json_or_text(cli.json, serde_json::to_value(profiles)?, "Profiles listed")?;
            }
            ProfileCommands::Use { profile_id } => {
                runtime.select_profile(profile_id.clone())?;
                print_json_or_text(
                    cli.json,
                    serde_json::json!({"ok":true,"active_profile":profile_id}),
                    "Profile selected",
                )?;
            }
        },
        Commands::Backend { command } => match command {
            BackendCommands::List => {
                let backends: Vec<_> = catalog.backends.keys().cloned().collect();
                print_json_or_text(cli.json, serde_json::to_value(backends)?, "Backends listed")?;
            }
            BackendCommands::Test { backend_id } => {
                runtime.test_backend(backend_id.clone())?;
                print_json_or_text(
                    cli.json,
                    serde_json::json!({"ok":true,"backend_id":backend_id}),
                    "Backend health check passed",
                )?;
            }
        },
        Commands::Auth { command } => match command {
            AuthCommands::Whoami { daemon_url, token } => {
                let daemon_url = resolve_daemon_url(daemon_url);
                let token = resolve_token(token)?;

                let client = build_client()?;
                let response = send_v1_json_request(
                    &client,
                    "GET",
                    &daemon_url,
                    "auth/whoami",
                    Some(&token),
                    None,
                )?;

                if response.status().is_success() {
                    let value: serde_json::Value = response.json()?;
                    print_json_or_text(cli.json, value, "Identity resolved")?;
                } else {
                    let (status, msg) = response_error(response);
                    anyhow::bail!("whoami failed ({status}): {msg}");
                }
            }

            AuthCommands::Login {
                daemon_url,
                qr,
                device_name,
            } => {
                let daemon_url = resolve_daemon_url(daemon_url);

                if !qr {
                    anyhow::bail!(
                        "Only --qr login is currently supported.\n\
                         Run: logline auth login --qr"
                    );
                }

                println!("Starting QR login flow...");
                println!("Daemon: {daemon_url}");

                let client = build_client()?;

                // 1. Create challenge.
                let challenge_url =
                    format!("{}/v1/cli/auth/challenge", daemon_url.trim_end_matches('/'));
                let device = device_name.unwrap_or_else(get_hostname);
                let body = serde_json::json!({ "device_name": device });

                let resp = client.post(&challenge_url).json(&body).send()?;
                if !resp.status().is_success() {
                    let status = resp.status();
                    anyhow::bail!("Failed to create auth challenge ({status})");
                }

                let challenge: ChallengeResponse = resp.json()?;

                println!("\nScan the QR code below with your authenticated mobile or web session:");
                render_qr_terminal(&challenge.challenge_url);
                println!("URL: {}", challenge.challenge_url);
                println!("Challenge ID: {}", challenge.challenge_id);
                println!("Expires: {}", challenge.expires_at);
                println!("\nWaiting for approval (Ctrl-C to cancel)...");

                // 2. Poll for approval.
                let status_url = format!(
                    "{}/v1/cli/auth/challenge/{}/status",
                    daemon_url.trim_end_matches('/'),
                    challenge.challenge_id
                );

                let token = poll_challenge_status(&client, &status_url)?;

                // 3. Fetch whoami to enrich stored credentials.
                let whoami_url = format!("{}/v1/auth/whoami", daemon_url.trim_end_matches('/'));
                let whoami_resp = client
                    .get(&whoami_url)
                    .header("authorization", format!("Bearer {token}"))
                    .send();

                let (user_id, email) = if let Ok(r) = whoami_resp {
                    if r.status().is_success() {
                        if let Ok(w) = r.json::<WhoamiResponse>() {
                            (Some(w.user_id), w.email)
                        } else {
                            (None, None)
                        }
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                };

                // 4. Save token.
                let stored = StoredAuth {
                    token: token.clone(),
                    daemon_url: daemon_url.clone(),
                    user_id: user_id.clone(),
                    email: email.clone(),
                    saved_at: now_unix_secs(),
                };
                save_stored_auth(&stored)?;

                println!("\nLogin successful!");
                if let Some(uid) = &user_id {
                    println!("User: {uid}");
                }
                if let Some(em) = &email {
                    println!("Email: {em}");
                }
                println!("Token saved to: {}", auth_token_path().display());

                print_json_or_text(
                    cli.json,
                    serde_json::json!({
                        "ok": true,
                        "user_id": user_id,
                        "email": email,
                        "daemon_url": daemon_url,
                        "token_path": auth_token_path().to_string_lossy()
                    }),
                    "Login complete",
                )?;
            }

            AuthCommands::TenantResolve { daemon_url, slug } => {
                let daemon_url = resolve_daemon_url(daemon_url);
                let client = build_client()?;
                let body = serde_json::json!({ "slug": slug });
                let response = send_v1_json_request(
                    &client,
                    "POST",
                    &daemon_url,
                    "auth/tenant/resolve",
                    None,
                    Some(&body),
                )?;

                if response.status().is_success() {
                    let value: serde_json::Value = response.json()?;
                    print_json_or_text(cli.json, value, "Tenant resolved")?;
                } else {
                    let (status, msg) = response_error(response);
                    anyhow::bail!("tenant resolve failed ({status}): {msg}");
                }
            }

            AuthCommands::OnboardClaim {
                daemon_url,
                token,
                tenant_slug,
                display_name,
            } => {
                let daemon_url = resolve_daemon_url(daemon_url);
                let token = resolve_token(token)?;
                let client = build_client()?;
                let mut body = serde_json::json!({
                    "tenant_slug": tenant_slug,
                });
                if let Some(name) = display_name {
                    body["display_name"] = serde_json::Value::String(name);
                }

                let response = send_v1_json_request(
                    &client,
                    "POST",
                    &daemon_url,
                    "auth/onboard/claim",
                    Some(&token),
                    Some(&body),
                )?;

                if response.status().is_success() {
                    let value: serde_json::Value = response.json()?;
                    print_json_or_text(cli.json, value, "Onboarding claim succeeded")?;
                } else {
                    let (status, msg) = response_error(response);
                    anyhow::bail!("onboard claim failed ({status}): {msg}");
                }
            }

            AuthCommands::OnboardFounder {
                daemon_url,
                token,
                tenant_slug,
                display_name,
                public_key,
                algorithm,
            } => {
                let daemon_url = resolve_daemon_url(daemon_url);
                let token = resolve_token(token)?;
                let client = build_client()?;

                let mut claim_body = serde_json::json!({
                    "tenant_slug": tenant_slug,
                });
                if let Some(name) = display_name {
                    claim_body["display_name"] = serde_json::Value::String(name);
                }

                let claim_resp = send_v1_json_request(
                    &client,
                    "POST",
                    &daemon_url,
                    "auth/onboard/claim",
                    Some(&token),
                    Some(&claim_body),
                )?;
                if !claim_resp.status().is_success() {
                    let (status, msg) = response_error(claim_resp);
                    anyhow::bail!("onboard claim failed ({status}): {msg}");
                }
                let claim_value: serde_json::Value = claim_resp.json()?;

                let whoami_resp = send_v1_json_request(
                    &client,
                    "GET",
                    &daemon_url,
                    "auth/whoami",
                    Some(&token),
                    None,
                )?;
                if !whoami_resp.status().is_success() {
                    let (status, msg) = response_error(whoami_resp);
                    anyhow::bail!("whoami after onboard failed ({status}): {msg}");
                }
                let whoami_value: serde_json::Value = whoami_resp.json()?;

                let founder_enabled = whoami_value
                    .get("capabilities")
                    .and_then(|v| v.as_array())
                    .is_some_and(|caps| caps.iter().any(|c| c.as_str() == Some("founder")));

                if !founder_enabled {
                    anyhow::bail!(
                        "onboarding succeeded but founder capability is missing; \
                         grant capability first, then rerun `logline auth onboard-founder`"
                    );
                }

                let key_register_value = if let Some(key) = public_key {
                    let key_body = serde_json::json!({
                        "public_key": key,
                        "algorithm": algorithm,
                    });
                    let key_resp = send_v1_json_request(
                        &client,
                        "POST",
                        &daemon_url,
                        "founder/keys/register",
                        Some(&token),
                        Some(&key_body),
                    )?;
                    if !key_resp.status().is_success() {
                        let (status, msg) = response_error(key_resp);
                        anyhow::bail!("founder key register failed ({status}): {msg}");
                    }
                    Some(key_resp.json::<serde_json::Value>()?)
                } else {
                    None
                };

                print_json_or_text(
                    cli.json,
                    serde_json::json!({
                        "ok": true,
                        "claim": claim_value,
                        "whoami": whoami_value,
                        "founder_key_register": key_register_value,
                    }),
                    "Founder onboarding complete",
                )?;
            }

            AuthCommands::Status { daemon_url } => {
                let stored = load_stored_auth();
                match stored {
                    None => {
                        if !cli.json {
                            println!("Not logged in. Run: logline auth login --qr");
                        }
                        print_json_or_text(
                            cli.json,
                            serde_json::json!({"logged_in": false}),
                            "Not logged in",
                        )?;
                    }
                    Some(auth) => {
                        let url = daemon_url.unwrap_or_else(|| auth.daemon_url.clone());
                        let client = build_client()?;
                        let valid = send_v1_json_request(
                            &client,
                            "GET",
                            &url,
                            "auth/whoami",
                            Some(&auth.token),
                            None,
                        )
                        .map(|r| r.status().is_success())
                        .unwrap_or(false);

                        print_json_or_text(
                            cli.json,
                            serde_json::json!({
                                "logged_in": true,
                                "token_valid": valid,
                                "user_id": auth.user_id,
                                "email": auth.email,
                                "daemon_url": auth.daemon_url,
                                "saved_at": auth.saved_at,
                                "token_path": auth_token_path().to_string_lossy()
                            }),
                            &format!(
                                "Logged in as {} (token {})",
                                auth.user_id.as_deref().unwrap_or("unknown"),
                                if valid { "valid" } else { "expired/invalid" }
                            ),
                        )?;
                    }
                }
            }

            AuthCommands::Logout => {
                delete_stored_auth()?;
                print_json_or_text(
                    cli.json,
                    serde_json::json!({"ok": true}),
                    "Logged out. Token removed.",
                )?;
            }
        },

        Commands::Supabase { command } => match command {
            SupabaseCommands::Check { workdir } => {
                let version = run_supabase_capture(&["--version"], workdir.as_ref())?;
                if !version.ok {
                    anyhow::bail!(
                        "supabase CLI check failed: {}",
                        pick_non_empty(&version.stderr, &version.stdout)
                    );
                }

                let projects = run_supabase_capture(&["projects", "list"], workdir.as_ref())?;
                let migrations =
                    run_supabase_capture(&["migration", "list", "--linked"], workdir.as_ref())?;

                let value = serde_json::json!({
                    "version": version.stdout.trim(),
                    "projects": {
                        "ok": projects.ok,
                        "code": projects.code,
                        "stdout": projects.stdout.trim(),
                        "stderr": projects.stderr.trim()
                    },
                    "linked_migrations": {
                        "ok": migrations.ok,
                        "code": migrations.code,
                        "stdout": migrations.stdout.trim(),
                        "stderr": migrations.stderr.trim()
                    },
                    "hints": [
                        "If projects fail: run `supabase login`.",
                        "If linked migrations fail: run `supabase link --project-ref <ref>`."
                    ]
                });

                if cli.json {
                    println!("{}", serde_json::to_string_pretty(&value)?);
                } else {
                    println!("Supabase CLI: {}", version.stdout.trim());
                    println!(
                        "Projects: {}",
                        if projects.ok {
                            "ok"
                        } else {
                            "needs login (run supabase login)"
                        }
                    );
                    println!(
                        "Linked migrations: {}",
                        if migrations.ok {
                            "ok"
                        } else {
                            "not linked (run supabase link --project-ref <ref>)"
                        }
                    );
                    if !projects.ok {
                        println!(
                            "projects detail: {}",
                            pick_non_empty(&projects.stderr, &projects.stdout)
                        );
                    }
                    if !migrations.ok {
                        println!(
                            "migrations detail: {}",
                            pick_non_empty(&migrations.stderr, &migrations.stdout)
                        );
                    }
                }
            }
            SupabaseCommands::Projects { workdir } => {
                run_supabase_stream(&["projects", "list"], workdir.as_ref())?;
            }
            SupabaseCommands::Link {
                project_ref,
                workdir,
            } => {
                run_supabase_stream(
                    &["link", "--project-ref", project_ref.as_str()],
                    workdir.as_ref(),
                )?;
            }
            SupabaseCommands::Migrate { workdir } => {
                run_supabase_stream(&["db", "push", "--linked"], workdir.as_ref())?;
            }
            SupabaseCommands::Raw { workdir, args } => {
                if args.is_empty() {
                    anyhow::bail!(
                        "supabase raw requires arguments, e.g. `logline supabase raw projects list`"
                    );
                }
                let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
                run_supabase_stream(&borrowed, workdir.as_ref())?;
            }
        },
    }

    Ok(())
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

fn resolve_v1_urls(base_url: &str, path: &str) -> Vec<String> {
    let base = base_url.trim_end_matches('/');
    let route = path.trim_start_matches('/');

    if base.ends_with("/api") {
        return vec![format!("{base}/v1/{route}")];
    }

    vec![
        format!("{base}/api/v1/{route}"),
        format!("{base}/v1/{route}"),
    ]
}

fn send_v1_json_request(
    client: &reqwest::blocking::Client,
    method: &str,
    base_url: &str,
    path: &str,
    bearer_token: Option<&str>,
    body: Option<&serde_json::Value>,
) -> anyhow::Result<reqwest::blocking::Response> {
    let urls = resolve_v1_urls(base_url, path);
    let mut last_error = String::new();

    for url in urls {
        let mut request = match method {
            "GET" => client.get(&url),
            "POST" => client.post(&url),
            other => anyhow::bail!("unsupported HTTP method: {other}"),
        };

        if let Some(token) = bearer_token {
            request = request.header("authorization", format!("Bearer {token}"));
            request = request.header("x-logline-token", token);
        }

        if let Some(json_body) = body {
            request = request.json(json_body);
        }

        match request.send() {
            Ok(resp) if resp.status() != reqwest::StatusCode::NOT_FOUND => return Ok(resp),
            Ok(resp) => {
                last_error = format!("{url} -> {}", resp.status());
                continue;
            }
            Err(err) => {
                last_error = format!("{url} -> {err}");
                continue;
            }
        }
    }

    anyhow::bail!("request failed for path `{path}`: {last_error}")
}

fn response_error(response: reqwest::blocking::Response) -> (reqwest::StatusCode, String) {
    let status = response.status();
    let text = response.text().unwrap_or_default();
    if text.trim().is_empty() {
        return (status, "request failed".to_string());
    }

    if let Ok(err) = serde_json::from_str::<DaemonError>(&text) {
        return (status, err.error);
    }

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
        if let Some(msg) = value.get("error").and_then(|v| v.as_str()) {
            return (status, msg.to_string());
        }
    }

    (status, text)
}

fn resolve_daemon_url(override_url: Option<String>) -> String {
    override_url
        .or_else(|| std::env::var("LOGLINE_DAEMON_URL").ok())
        .unwrap_or_else(|| "http://127.0.0.1:7600".to_string())
}

fn resolve_token(override_token: Option<String>) -> anyhow::Result<String> {
    if let Some(t) = override_token {
        return Ok(t);
    }
    if let Ok(t) = std::env::var("LOGLINE_DAEMON_TOKEN") {
        if !t.trim().is_empty() {
            return Ok(t.trim().to_string());
        }
    }
    if let Some(stored) = load_stored_auth() {
        return Ok(stored.token);
    }
    anyhow::bail!(
        "No auth token found.\n\
         Run `logline auth login --qr` or set LOGLINE_DAEMON_TOKEN env var."
    )
}

fn build_client() -> anyhow::Result<reqwest::blocking::Client> {
    Ok(reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?)
}

fn poll_challenge_status(
    client: &reqwest::blocking::Client,
    status_url: &str,
) -> anyhow::Result<String> {
    // Poll for up to 5 minutes (100 attempts × 3 s = 300 s).
    for i in 0..100_u32 {
        if i > 0 {
            thread::sleep(Duration::from_secs(3));
        }

        let resp = client.get(status_url).send()?;
        if !resp.status().is_success() {
            anyhow::bail!("Challenge status check failed: {}", resp.status());
        }

        let cs: ChallengeStatus = resp.json()?;

        match cs.status.as_str() {
            "approved" => {
                let token = cs.session_token.ok_or_else(|| {
                    anyhow::anyhow!("Challenge approved but no session token in response")
                })?;
                println!("\nChallenge approved!");
                return Ok(token);
            }
            "denied" => {
                anyhow::bail!("Challenge was denied by the approving user.");
            }
            "expired" => {
                anyhow::bail!("Challenge expired. Run `logline auth login --qr` again.");
            }
            "pending" => {
                eprint!(".");
                let _ = std::io::Write::flush(&mut std::io::stderr());
            }
            other => {
                anyhow::bail!("Unexpected challenge status: {other}");
            }
        }
    }

    anyhow::bail!("Timeout waiting for QR approval. Run `logline auth login --qr` again.")
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

#[derive(Debug)]
struct CmdResult {
    ok: bool,
    code: i32,
    stdout: String,
    stderr: String,
}

fn run_supabase_capture(args: &[&str], workdir: Option<&PathBuf>) -> anyhow::Result<CmdResult> {
    let mut cmd = Command::new("supabase");
    if let Some(wd) = workdir {
        cmd.arg("--workdir").arg(wd);
    }
    apply_supabase_env(&mut cmd, workdir);
    cmd.args(args);

    let output = cmd.output().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            anyhow::anyhow!(
                "supabase CLI not found. Install with `brew install supabase/tap/supabase`"
            )
        } else {
            anyhow::anyhow!(e)
        }
    })?;

    Ok(to_cmd_result(output))
}

fn run_supabase_stream(args: &[&str], workdir: Option<&PathBuf>) -> anyhow::Result<()> {
    let mut cmd = Command::new("supabase");
    if let Some(wd) = workdir {
        cmd.arg("--workdir").arg(wd);
    }
    apply_supabase_env(&mut cmd, workdir);
    cmd.args(args)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .stdin(Stdio::inherit());

    let status = cmd.status().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            anyhow::anyhow!(
                "supabase CLI not found. Install with `brew install supabase/tap/supabase`"
            )
        } else {
            anyhow::anyhow!(e)
        }
    })?;

    if status.success() {
        Ok(())
    } else {
        anyhow::bail!("supabase command failed with status {status}");
    }
}

fn to_cmd_result(output: Output) -> CmdResult {
    CmdResult {
        ok: output.status.success(),
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    }
}

fn pick_non_empty(primary: &str, fallback: &str) -> String {
    if !primary.trim().is_empty() {
        primary.trim().to_string()
    } else {
        fallback.trim().to_string()
    }
}

fn apply_supabase_env(cmd: &mut Command, workdir: Option<&PathBuf>) {
    let has_access = std::env::var("SUPABASE_ACCESS_TOKEN")
        .ok()
        .is_some_and(|v| !v.trim().is_empty());
    let has_account = std::env::var("SUPABASE_ACCOUNT_TOKEN")
        .ok()
        .is_some_and(|v| !v.trim().is_empty());
    if has_access || has_account {
        return;
    }

    let token = find_supabase_token_from_env_files(workdir);
    if let Some(token) = token {
        cmd.env("SUPABASE_ACCESS_TOKEN", token);
    }
}

fn find_supabase_token_from_env_files(workdir: Option<&PathBuf>) -> Option<String> {
    let base = workdir
        .cloned()
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")));

    for filename in [".env.local", ".env"] {
        let path = base.join(filename);
        let Ok(content) = fs::read_to_string(path) else {
            continue;
        };
        if let Some(token) = parse_env_value(&content, "SUPABASE_ACCESS_TOKEN")
            .or_else(|| parse_env_value(&content, "SUPABASE_ACCOUNT_TOKEN"))
        {
            return Some(token);
        };
    }

    None
}

fn parse_env_value(content: &str, key: &str) -> Option<String> {
    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let mut parts = line.splitn(2, '=');
        let k = parts.next()?.trim();
        let v = parts.next()?.trim();
        if k != key {
            continue;
        }

        let unquoted = if (v.starts_with('"') && v.ends_with('"'))
            || (v.starts_with('\'') && v.ends_with('\''))
        {
            v[1..v.len().saturating_sub(1)].trim()
        } else {
            v
        };

        if !unquoted.is_empty() {
            return Some(unquoted.to_string());
        }
    }
    None
}

fn parse_key_val(s: &str) -> Result<(String, String), String> {
    let pos = s.find('=').ok_or_else(|| "must be KEY=VALUE".to_string())?;
    Ok((s[..pos].to_string(), s[pos + 1..].to_string()))
}

fn print_json_or_text(json_mode: bool, value: serde_json::Value, text: &str) -> anyhow::Result<()> {
    if json_mode {
        println!("{}", serde_json::to_string_pretty(&value)?);
    } else {
        println!("{text}");
    }
    Ok(())
}
