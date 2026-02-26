use std::collections::BTreeMap;
use std::path::PathBuf;
use std::time::Duration;

use clap::{Parser, Subcommand};
use logline_api::{Intent, RuntimeEngine};
use logline_core::{
    default_config_dir, demo_catalog, load_catalog_from_dir, write_default_config_files,
};
use logline_runtime::LoglineRuntime;
use serde::Deserialize;

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
    Stop {
        run_id: String,
    },
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
    /// Authentication operations against daemon
    Auth {
        #[command(subcommand)]
        command: AuthCommands,
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
        /// Auth token sent as x-logline-token header
        #[arg(long)]
        token: Option<String>,
    },
}

#[derive(Debug, Deserialize)]
struct DaemonError {
    error: String,
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
            print_json_or_text(cli.json, serde_json::to_value(status)?, "Runtime status retrieved")?;
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
                let daemon_url = daemon_url
                    .or_else(|| std::env::var("LOGLINE_DAEMON_URL").ok())
                    .unwrap_or_else(|| "http://127.0.0.1:7600".to_string());
                let token = token
                    .or_else(|| std::env::var("LOGLINE_DAEMON_TOKEN").ok())
                    .ok_or_else(|| {
                        anyhow::anyhow!("missing auth token: pass --token or set LOGLINE_DAEMON_TOKEN")
                    })?;

                let url = format!("{}/v1/auth/whoami", daemon_url.trim_end_matches('/'));
                let client = reqwest::blocking::Client::builder()
                    .timeout(Duration::from_secs(15))
                    .build()?;
                let response = client
                    .get(&url)
                    .header("x-logline-token", token)
                    .send()?;

                if response.status().is_success() {
                    let value: serde_json::Value = response.json()?;
                    print_json_or_text(cli.json, value, "Identity resolved")?;
                } else {
                    let status = response.status();
                    let maybe_error = response.json::<DaemonError>().ok();
                    let msg = maybe_error
                        .map(|e| e.error)
                        .unwrap_or_else(|| "daemon request failed".to_string());
                    anyhow::bail!("whoami failed ({status}): {msg}");
                }
            }
        },
    }

    Ok(())
}

fn parse_key_val(s: &str) -> Result<(String, String), String> {
    let pos = s
        .find('=')
        .ok_or_else(|| "must be KEY=VALUE".to_string())?;
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
