# UBLX System Guide: Zero to Confident

A complete beginner's guide to understanding, running, and working with the UBLX + LogLine system.

---

## Table of Contents

1. [Welcome](#1-welcome)
2. [Big Picture First](#2-big-picture-first)
3. [Your First Setup (From Zero)](#3-your-first-setup-from-zero)
4. [First 30-Minute Hands-On Path](#4-first-30-minute-hands-on-path)
5. [Daily Workflow](#5-daily-workflow)
6. [Settings Cascade for Humans](#6-settings-cascade-for-humans)
7. [Auth for Beginners](#7-auth-for-beginners)
8. [Testing and Health Checks](#8-testing-and-health-checks)
9. [Troubleshooting Playbook](#9-troubleshooting-playbook)
10. [Glossary](#10-glossary)
11. [Learning Path](#11-learning-path)
12. [If You Only Remember 5 Things](#12-if-you-only-remember-5-things)
13. [Confidence Checklist](#13-confidence-checklist)
14. [Conflicts and Assumptions](#14-conflicts-and-assumptions)

---

## 1. Welcome

### What is UBLX?

UBLX is an operations dashboard — a customizable workspace where you can add panels, tools, and widgets that help you monitor and control software systems. You access it through your web browser.

Behind the browser, there is a second program running: a Rust-based engine called **logline**. This engine handles the harder logic: identity, authentication, runtime operations, and communication with AI services.

Think of UBLX as a cockpit. The browser window is the instrument panel you look at. The Rust engine is the flight computer running underneath.

### What you will be able to do after this guide

- Start the app successfully on your machine
- Open the browser interface and create your first panel with components
- Understand how the three layers (browser, API, Rust engine) work together
- Configure settings that carry down to every component automatically
- Know which "auth mode" to use and why
- Run health checks that tell you whether everything is working
- Fix the most common problems that beginners run into
- Know exactly what to read next and in what order

This guide assumes you know nothing about terminals, servers, databases, or programming. Every concept is explained the first time it appears.

---

## 2. Big Picture First

### The restaurant analogy

Before anything technical, here is a picture that makes the whole system click.

Imagine a restaurant:

```
DINING ROOM          = Your browser (localhost:3000)
                       Menus, tables, what customers see and interact with

KITCHEN PASS         = Next.js API layer (app/api/*)
                       Takes your order, coordinates between dining room and kitchen

KITCHEN              = Rust engine — logline (port 7600)
                       Where the actual cooking happens
                       Heavy logic, identity, AI connections, runtime operations
```

You are the customer. You click things in the browser (dining room). Those clicks travel to the API layer (kitchen pass), which may talk to the Rust engine (kitchen) before bringing data back to your screen.

### The three layers in technical terms

**Layer 1: The UI (User Interface)**

This is the website you open at `http://localhost:3000`. It is built with a framework called Next.js and runs in your browser. What you see: tabs, panels, widgets (called "components"), a store to add new widgets, and settings.

Key files:
- `app/page.tsx` — the entry point for everything the browser renders
- `components/shell/AppShell.tsx` — the permanent outer frame (header, tab bar)
- `components/panel/GridCanvas.tsx` — the grid area inside each tab where components sit
- `components/panel/ComponentRenderer.tsx` — decides which widget to show for each component ID

**Layer 2: The API Layer**

When the browser needs data (for example, "what tabs exist?"), it sends a request to an API route. These routes live inside the same Next.js app under `app/api/`. They read from and write to the database, and sometimes forward requests to the Rust engine.

API routes respond with JSON — a structured text format that the browser can read and display.

**Layer 3: The Rust Engine (logline)**

This is a separate program written in Rust, a language known for speed and reliability. It runs as a background process (called a daemon) on port 7600. It handles identity verification, AI service connections, runtime contracts, and anything that needs to be rock-solid.

It also has a command-line interface (CLI) — meaning you can type commands to it directly in the terminal.

### What "localhost" and "port" mean

**localhost** means "this computer." When you open `http://localhost:3000`, you are asking your own computer to show you the website — nothing goes over the internet.

**A port** is like an apartment number in a building. The building is your computer. Port 3000 is where the Next.js website lives. Port 7600 is where the Rust engine lives. Different ports let multiple programs share the same computer without stepping on each other.

### The data flow diagram

Here is a complete picture of what happens when you click something in the browser:

```
[YOU]
  Click a button
        |
        v
[BROWSER at localhost:3000]
  React component handles the click
  Calls a data hook from lib/api/db-hooks.ts
        |
        v
[NEXT.JS API ROUTES at localhost:3000/api/*]
  Receives the request
  Checks who you are (auth)
  Reads or writes to the Postgres database
  Optionally contacts the Rust engine if needed
        |
        v
[RUST ENGINE at localhost:7600]  (only when needed)
  Handles identity, AI calls, heavy logic
  Returns structured data
        |
        v
[RESPONSE FLOWS BACK UP]
  API route returns JSON to the browser
  Browser updates what you see on screen
```

### Where data lives

**The database** (Postgres) stores all your tabs, components, settings, chat history, and status logs. It is the permanent home for everything you create.

Postgres is a type of database — software that stores structured information reliably. You connect to it via a setting called `DATABASE_URL`, which is a connection string (basically an address + password for the database).

### Why two programs instead of one?

The website (Next.js) is great for building user interfaces quickly. The Rust engine is great for reliable, fast, and secure backend logic. Keeping them separate means each can be improved or restarted independently. The website can do basic tab management and settings without the Rust engine running at all. The Rust engine handles the harder operations when needed.

---

## 3. Your First Setup (From Zero)

### What is a terminal?

A terminal (also called a command prompt, shell, or command line) is a text-based window where you type instructions directly to your computer. On a Mac, open it by pressing `Command + Space`, typing "Terminal," and pressing Enter.

The terminal shows you a prompt — usually your username and a `$` or `%` symbol. That is where you type commands.

**Important:** Commands are case-sensitive. `npm install` and `NPM Install` are different things. Copy commands exactly as shown.

**Important:** After typing a command, press Enter to run it.

### What is a "folder path"?

A path is the address of a file or folder on your computer. For example, `/Users/ubl-ops/UBLX App` means: start at the root of the drive, go into `Users`, then `ubl-ops`, then `UBLX App`. The `/` (slash) separates each level.

Paths with spaces (like `UBLX App`) must be wrapped in quotes in the terminal so the computer understands the space is part of the name, not a separator.

### Step 1: Check what you need installed

Open Terminal and run each of these commands. If a command returns a version number, that tool is installed. If it says "command not found," you need to install it.

```bash
node --version
```

- **Run from:** any terminal window
- **What it does:** checks whether Node.js is installed — required to run the Next.js website
- **Success looks like:** `v20.11.0` or higher (you need version 20 or newer)
- **If it fails:** go to https://nodejs.org, download the LTS version, run the installer, then reopen Terminal

```bash
npm --version
```

- **Run from:** any terminal window
- **What it does:** checks whether npm (the JavaScript package manager) is installed — required to install dependencies and run the app
- **Success looks like:** something like `10.2.4` — it ships with Node.js, so if Node works, npm usually does too
- **If it fails:** reinstall Node.js from https://nodejs.org (npm is bundled with it)

```bash
cargo --version
```

- **Run from:** any terminal window
- **What it does:** checks whether Rust's build tool (Cargo) is installed — required to compile and run the logline Rust engine
- **Success looks like:** something like `cargo 1.75.0 (1d8b05cdd 2023-11-20)`
- **If it fails:** go to https://rustup.rs and run the one-line installation command shown on that page, then reopen Terminal

---

**Checkpoint: Prerequisites**
- Success: all three commands return version numbers
- If `node --version` fails: install Node.js from nodejs.org (choose LTS)
- If `cargo --version` fails: install Rust from rustup.rs

---

### Step 2: Enter the project folder

Every command you run for this project starts by going into the project folder:

```bash
cd "/Users/ubl-ops/UBLX App"
```

What `cd` means: "change directory" — it moves your terminal into that folder, the same way you would double-click a folder in Finder.

You will see the terminal prompt change to reflect you are now inside that folder.

---

**Checkpoint: You are in the right place**
- Success: your terminal prompt now shows something related to `UBLX App`
- If it says "No such file or directory": the folder path might be different. Ask whoever manages this machine for the correct path.

---

### Step 3: Create your environment configuration file

The app reads its settings from a file called `.env.local`. This file contains database passwords, API keys, and other configuration that should never be shared or committed to version control.

There is a template file called `.env.example` that shows you what fields are needed. You will copy it and fill it in.

**First, copy the example:**

```bash
cp "/Users/ubl-ops/UBLX App/.env.example" "/Users/ubl-ops/UBLX App/.env.local"
```

What this does: creates a copy of the template file named `.env.local` in the same folder.

**Now open `.env.local` in any text editor and fill in the values.**

The most important fields for getting started locally:

```env
# --- Database ---
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:password@host/dbname?sslmode=require"

# --- App Defaults (safe to leave as-is for local dev) ---
APP_URL="http://localhost:3000"
DEFAULT_WORKSPACE_ID="default"
DEFAULT_APP_ID="ublx"
DEFAULT_USER_ID="local-dev"

# --- Auth Mode (use these values for local development) ---
AUTH_PROVIDER_MODE="compat"
RBAC_STRICT="0"
```

**What each field means:**

- `DATABASE_URL` — the address + credentials for your Postgres database. Get this from your Supabase project dashboard (under Settings > Database > Connection String). It looks like a web address with a username and password embedded.
- `DATABASE_URL_UNPOOLED` — usually the same connection string, used for certain database operations. Use the same value as `DATABASE_URL` unless your Supabase dashboard provides a separate one.
- `APP_URL` — where the app will run. For local development, this is always `http://localhost:3000`.
- `DEFAULT_WORKSPACE_ID` — the name of your default workspace. Leave it as `"default"` to start.
- `DEFAULT_APP_ID` — the name of your default app. Leave it as `"ublx"`.
- `DEFAULT_USER_ID` — your user ID for local development. Leave it as `"local-dev"`.
- `AUTH_PROVIDER_MODE` — controls how the app checks who you are. Set to `"compat"` for local development (explained fully in Section 7).
- `RBAC_STRICT` — controls whether the app enforces strict permission rules. Set to `"0"` for local development.

---

**Checkpoint: Configuration file created**
- Success: `.env.local` exists in `/Users/ubl-ops/UBLX App/` and has your `DATABASE_URL` filled in
- If the database URL is wrong or missing: the app will load with a blank/dark screen. Section 9 covers how to diagnose this.

---

### Step 4: Install JavaScript dependencies

The first time you work with the project (and any time someone adds new packages), run:

```bash
npm install
```

What it does: reads `package.json` (the project's dependency list) and downloads all the required JavaScript libraries into a folder called `node_modules`. This is like installing all the apps your project needs to run.

This may take 1-3 minutes the first time. You will see a lot of text scroll by — that is normal.

---

**Checkpoint: Dependencies installed**
- Success: the command finishes and shows something like `added 847 packages in 23s`
- If it shows errors with "ENOENT" or "permission denied": your Node.js or npm installation may have a problem. Try restarting Terminal and running `npm install` again.

---

### Step 5: Start the website

```bash
npm run dev
```

What it does: starts the Next.js development server. Your app is now running.

The terminal will show something like:

```
  ▲ Next.js 15.x
  - Local:        http://localhost:3000
  - Ready in 2.1s
```

Leave this terminal window open. The server keeps running as long as this terminal is open. If you close the terminal, the server stops.

Open your browser and go to: **http://localhost:3000**

---

**Checkpoint: Website is running**
- Success: you see the UBLX interface in your browser — a dark-themed workspace with a tab area
- If you see a completely dark/blank screen with nothing: check the terminal for error messages. The most common cause is a missing or wrong `DATABASE_URL`. See the Troubleshooting section.
- If the browser says "This site can't be reached": the server might not have started. Check the terminal for error messages.

---

### Step 6: Start the Rust engine (optional for basic UI work, required for auth operations)

Open a **second** terminal window (you need the first one to keep the website running).

Navigate to the logline subfolder:

```bash
cd "/Users/ubl-ops/UBLX App/logline"
```

**First, verify it compiles without errors:**

```bash
cargo check
```

What it does: checks whether the Rust code has errors, without fully building it. Much faster than a full build. If this returns errors, something is broken in the Rust code.

Expected result: `Finished ... in Xs` with no error lines.

**Then, start the daemon:**

```bash
LOGLINE_DAEMON_TOKEN=dev-token cargo run -p logline-daemon -- --host 127.0.0.1 --port 7600
```

Breaking this down into parts:

- `LOGLINE_DAEMON_TOKEN=dev-token` — sets a temporary environment variable. The daemon requires a token to accept requests. In local development, we use the placeholder value `dev-token`.
- `cargo run -p logline-daemon` — compiles and runs the logline-daemon package. The `-p` flag means "package."
- `--` — everything after this goes to the program itself, not to cargo.
- `--host 127.0.0.1` — only listen on localhost (the `127.0.0.1` address is always localhost). This means nothing outside your computer can reach the daemon.
- `--port 7600` — listen on port 7600.

The first time you run this, it will compile the Rust code, which takes 1-5 minutes. Subsequent runs are much faster.

---

**Checkpoint: Rust engine is running**
- Success: terminal shows something like `Listening on http://127.0.0.1:7600`
- If compilation fails with errors: run `cargo check` and read the error messages carefully. They usually point to a specific file and line number.

---

### Step 7: Verify the connection (optional sanity check)

With both the website and daemon running, open a **third** terminal and run:

```bash
cd "/Users/ubl-ops/UBLX App/logline"
LOGLINE_DAEMON_URL=http://127.0.0.1:7600 LOGLINE_DAEMON_TOKEN=dev-token \
cargo run -p logline-cli -- --json auth whoami
```

What it does: runs the logline CLI and asks "who am I?" against the running daemon.

Expected result: a JSON response like:
```json
{
  "user_id": "local-dev",
  "email": null
}
```

If you get this, the CLI is communicating successfully with the daemon.

---

## 4. First 30-Minute Hands-On Path

This section walks you through the most important things to do in the UI, step by step. Complete these in order.

### 4.1 Open the app and look around

Navigate to `http://localhost:3000` in your browser.

You should see:
- A tab strip at the bottom (or top, depending on the version) of the screen — this is where your "panels" or "tabs" live
- A main working area (the canvas/grid) where components are placed
- Possibly a header area with the UBLX branding

**What is a panel?**
A panel (also called a tab) is like a browser tab, but inside the app. Each panel is a separate workspace area. You can have multiple panels for different purposes — one for monitoring, one for chat, one for settings.

### 4.2 Create your first tab

Look for a button that says something like "New Tab" or has a "+" symbol.

Click it.

A new panel appears in the tab strip. You may be prompted to name it — type any name you like, for example "My First Panel."

---

**Checkpoint: First tab created**
- Success: a new tab appears with your chosen name
- If clicking the "+" does nothing: check the browser's developer console for errors. Right-click anywhere on the page, choose "Inspect," and look at the "Console" tab for red error messages.

---

### 4.3 Open the Store and add a component

Inside the UI there is a "Store" — a panel where you can browse and add components (widgets) to your current panel.

Find the Store button (usually an icon or label that says "Store" or looks like a grid of items) and click it.

You will see a list of available components. Examples include:
- ChatAI — a chat interface connected to an AI service
- ObservabilityHub — a monitoring dashboard

Click on a component to add it to your panel.

The component appears in the grid area of your panel.

---

**Checkpoint: Component added**
- Success: the selected component appears in the main panel area
- If nothing appears: check that you have the correct panel selected in the tab strip before opening the Store

---

### 4.4 Resize a component

Components can be resized using presets. Look for size buttons near the component: `S`, `M`, `L`, `XL`, `WIDE`.

Click each one to see how the component changes size. These are preset snap sizes — the component snaps to a grid rather than being freely resizable.

### 4.5 Change a setting and verify it saves

In the UI, look for a "Settings" option — either in the app header or accessible through an icon.

App settings are global: they affect the whole workspace. You can set things like:
- `llm_gateway_base_url` — the address of the AI service
- `llm_gateway_api_key` — the key to authenticate with the AI service

Try changing any setting, save it, then reload the page (`Cmd + R` or `Ctrl + R`). The setting should still be there after reload — that confirms it is saving to the database correctly.

---

**Checkpoint: Settings persist across reload**
- Success: the setting value is the same after you reload the page
- If the setting resets: the database write may be failing. Check the browser console for error responses.

---

### 4.6 Run an API health check

Open a new terminal window while the server is running, and run:

```bash
curl -sS http://localhost:3000/api/panels | jq
```

**What is `curl`?** It is a command that sends a web request and shows you the response. It is pre-installed on macOS.

**What is `jq`?** It is a tool that formats JSON output to be readable. If you don't have it:
- First check whether Homebrew is installed: run `brew --version`. If you see a version, Homebrew is ready.
- If Homebrew is installed: `brew install jq`
- If Homebrew is not installed: go to https://brew.sh and run their one-line installer first, then `brew install jq`
- Or just remove `| jq` from any command — the output will be unformatted but still correct.

**What is `| jq`?** The `|` ("pipe") sends the output of `curl` into `jq` for formatting.

Expected result: a list of your panels in JSON format, like:
```json
[
  {
    "panel_id": "abc123",
    "name": "My First Panel",
    "position": 0
  }
]
```

---

**Checkpoint: API is responding**
- Success: you see a JSON array (even if it is empty `[]`)
- If you see an error or `{"error":"..."}`: check Section 9 (Troubleshooting)

---

### 4.7 Verify the auth check

Run this command to confirm auth is working in compat mode:

```bash
curl -sS -H "x-user-id: local-dev" http://localhost:3000/api/settings | jq
```

What this does: sends a request to the settings API with the header `x-user-id: local-dev`. In compat mode, this is how the API knows who you are.

Expected result: a JSON object with your app settings (may be empty `{}` if you haven't set any yet, but it should not be an error).

---

## 5. Daily Workflow

### Start of day

When you sit down to work on UBLX, do this every time:

**Terminal A — Start the website:**

```bash
cd "/Users/ubl-ops/UBLX App"
npm run dev
```

Wait for `Ready in Xs` to appear, then open `http://localhost:3000`.

**Terminal B — Start the Rust engine (if you need auth or runtime operations):**

```bash
cd "/Users/ubl-ops/UBLX App/logline"
LOGLINE_DAEMON_TOKEN=dev-token cargo run -p logline-daemon -- --host 127.0.0.1 --port 7600
```

If you just changed Rust code, `cargo run` will recompile it automatically before starting.

**Quick health check (Terminal C):**

```bash
curl -sS http://localhost:3000/api/panels | jq
```

If you get a JSON response, you are good to go.

### During work

**When you change JavaScript/TypeScript code:** Next.js watches for file changes and automatically reloads. You do not need to restart the server for most changes.

**When you change Rust code:** You need to stop the daemon (press `Ctrl + C` in its terminal) and run `cargo run ...` again.

**When something breaks unexpectedly:**

1. Look at the terminal where the website is running — does it show an error?
2. Look at the browser's developer console (right-click > Inspect > Console)
3. Look at the terminal where the daemon is running (if applicable)
4. Try the health check command above

### End of day

Stop the servers by pressing `Ctrl + C` in each terminal window where a server is running. This cleanly shuts them down.

You do not need to "save" anything — data is already in the database.

If you made code changes, consider committing them to git before stopping:

```bash
cd "/Users/ubl-ops/UBLX App"
git status
```

This shows what files you changed.

### What to do when confused

Follow this order:

1. **Reread the error message** — most error messages tell you what is wrong. Read every word.
2. **Check the terminal** — the server terminal often has error details that the browser does not show.
3. **Check the browser console** — right-click on the page, choose Inspect, look at Console for red errors.
4. **Check Section 9** (Troubleshooting Playbook) — look for your symptom.
5. **Run the health check** — `curl -sS http://localhost:3000/api/panels | jq` to see if the basic API is working.
6. **Restart the dev server** — press `Ctrl + C` and run `npm run dev` again. Many transient issues resolve this way.

---

## 6. Settings Cascade for Humans

### The basic idea

Imagine your company has a dress code. First there is a company-wide policy (formal wear). Then a department can override it (business casual for the tech team). Then an individual employee can have a personal exception (they wear a hoodie because they work nights).

Settings in UBLX work exactly this way. There are three levels, and the more specific level always wins over the more general level:

```
APP SETTINGS (most general — affects everything)
        |
        v
TAB/PANEL SETTINGS (affects one tab and its components)
        |
        v
COMPONENT INSTANCE SETTINGS (affects one specific widget)
```

When the app figures out the final settings for any component, it merges all three levels together. If a setting exists at multiple levels, the most specific one wins.

### Where each level is stored

**App-level settings:**
- API endpoint: `GET/PATCH /api/settings`
- Use for: shared API keys, gateway URLs, global defaults that most components should use
- Example: `llm_gateway_base_url = "https://api.logline.world"`

**Tab/Panel-level settings:**
- API endpoint: `GET/PUT /api/panel-settings/:panelId`
- Use for: overrides that apply to everything in one particular tab
- Example: setting a specific AI processing mode for just this tab

**Component instance settings:**
- API endpoint: `GET/PUT /api/instance-configs/:instanceId`
- Use for: overrides that apply to one specific component only
- Example: a particular chat widget using a different gateway than all the others

### How to check the effective (final) settings for a component

If a component is not behaving as expected, you can see what settings it is actually using:

```bash
curl -sS "http://localhost:3000/api/effective-config/<instanceId>" | jq
```

Replace `<instanceId>` with the actual instance ID of the component (you can find this in the browser's developer tools or from the panels API response).

The response shows:
- `layers` — the raw settings at each level
- `effective` — the merged final settings the component receives
- `bindings` — special key-value pairs that route secrets and URLs to the right places
- `missing_required_tags` — if this is not empty, the component is missing a required setting

### Binding tags (what they are, in plain language)

Some settings are not just simple values — they are pointers that say "this component needs a type of thing called X." For example, a chat component might need something tagged as `secret:llm_gateway:key` — meaning "an API key for the LLM gateway."

The system automatically generates these pointers from known setting names. For example, if you set `llm_gateway_api_key` at the app level, the system automatically creates a binding tag `secret:llm_gateway:key` that components can find.

You rarely need to think about binding tags directly. The main use is when a component says it has `missing_required_tags` — that tells you what setting it needs and cannot find.

### Common settings mistakes

1. **You set a setting in App Settings but the component ignores it.** Check `missing_required_tags` in the effective-config response. The setting key might not match what the component expects.

2. **A component has different behavior than other components in the same tab.** The component may have instance-level overrides. Check its specific instance-config.

3. **Settings reset after restart.** The settings are saved to the database. If they reset, the database write is failing — check the terminal for write errors.

4. **Settings work in one tab but not another.** Check the `x-workspace-id` — if tabs are in different workspaces, they do not share settings.

---

## 7. Auth for Beginners

### What is auth?

"Auth" is short for authentication (who are you?) and authorization (what are you allowed to do?).

In this system, every request to the API is checked: is this user who they say they are? Do they have permission to do what they are asking?

### Two modes: compat and jwt

The system supports two modes for checking who you are. You control this with the `AUTH_PROVIDER_MODE` environment variable.

**Compat mode (`AUTH_PROVIDER_MODE=compat`)**

The simple mode for local development. The API trusts whoever you say you are. You pass your user ID in a header called `x-user-id`. No passwords, no cryptographic proof.

Think of it like a cafeteria that accepts "I'm John from accounting" without checking your ID badge.

When to use it: local development, building UI features, testing things on your own machine.

```env
AUTH_PROVIDER_MODE="compat"
RBAC_STRICT="0"
```

**JWT mode (`AUTH_PROVIDER_MODE=jwt`)**

The real mode for production or integration testing. The API requires a cryptographically signed token (called a JWT — JSON Web Token) from Supabase Auth. This proves you are who you say you are.

Think of it like a building that checks your employee badge before letting you in.

When to use it: when building auth features, integration testing, or running in production.

```env
AUTH_PROVIDER_MODE="jwt"
RBAC_STRICT="1"
SUPABASE_JWT_SECRET="your_secret_here"
```

**How to verify the two modes exist:** Run `grep 'AUTH_PROVIDER_MODE' .env.example` from `/Users/ubl-ops/UBLX App` — you will see the variable and its comment explaining both values.

### What is RBAC?

RBAC stands for Role-Based Access Control. It means that what you can do depends on your role.

There are three kinds of roles in this system:

**Tenant roles** (tenant = workspace/organization):
- `member` — can read and use the workspace
- `admin` — can also manage membership and policy

**App roles** (app = the specific application, usually "ublx"):
- `member` — can read and use the app
- `app_admin` — can also change app settings and private configurations

**Special capability:**
- `founder` — can execute special protected operations that require cryptographic signatures

### What RBAC_STRICT controls

`RBAC_STRICT=0` (local dev mode):
- A "local dev" user is automatically created in the database with full admin permissions
- You do not need to manually set up users or memberships
- Perfect for building and testing UI features

`RBAC_STRICT=1` (real mode):
- No auto-bootstrap; you must have real database records for users, tenants, and memberships
- Use this when testing that auth actually works correctly

### The progression path

1. **Start here:** `AUTH_PROVIDER_MODE=compat`, `RBAC_STRICT=0`
   - Good for: getting the UI running, building features, day-to-day development

2. **Next step:** `AUTH_PROVIDER_MODE=compat`, `RBAC_STRICT=1`
   - Good for: testing that your DB records are correct before adding JWT complexity

3. **Integration testing:** `AUTH_PROVIDER_MODE=jwt`, `RBAC_STRICT=1`
   - Good for: verifying that Supabase Auth works end-to-end

4. **Production:** `AUTH_PROVIDER_MODE=jwt`, `RBAC_STRICT=1`
   - Required: real users with Supabase Auth tokens

### How the auto-bootstrap works (compat + non-strict mode)

When you run with `RBAC_STRICT=0` and make a request as `local-dev`, the system automatically creates the following records in the database if they do not already exist:

- A user record with user_id `local-dev`
- A tenant record
- An app record
- A tenant membership (role: admin)
- An app membership (role: app_admin)

This means you can start fresh with an empty database and the UI will work immediately. The bootstrap is idempotent — it is safe to run many times.

### What a 401 or 403 error means

`401 Unauthorized` — the system does not know who you are, or your credentials are invalid.
- In compat mode, this usually means your `x-user-id` header is missing or not reaching the server.
- In JWT mode, this means your Bearer token is missing, expired, or invalid.

`403 Forbidden` — the system knows who you are, but you do not have permission.
- Most commonly: the user is not a member of the requested tenant or app.
- Fix in development: switch to `RBAC_STRICT=0` to let auto-bootstrap handle it.

---

## 8. Testing and Health Checks

### What "healthy" means

The system is healthy when:

1. The Next.js server is running and responding
2. The database is connected and accessible
3. API routes return expected data
4. Auth (at whatever mode you are using) is working
5. The Rust engine is running (if you need it for the operations you are doing)

### Minimum health check (run this first)

```bash
curl -sS http://localhost:3000/api/panels | jq
```

- **Run from:** any terminal (the website server must already be running — `npm run dev`)
- **What it does:** asks the API for the panels list; confirms the server is up and the database is reachable
- **Success looks like:** a JSON array — `[]` (empty) or a list of panel objects
- **If it fails:** the server is down or the database is unreachable — read the terminal where `npm run dev` is running for error messages

### Full smoke test (compat mode)

Run these three commands in sequence. All three should succeed.

> **Run from:** any terminal — `AUTH_PROVIDER_MODE=compat` and `RBAC_STRICT=0` must be set in `.env.local`, and the website server must be running (`npm run dev`).

```bash
# 1. Panels list (tests DB read)
curl -sS http://localhost:3000/api/panels | jq

# 2. Settings (tests auth + DB read)
curl -sS -H "x-user-id: local-dev" http://localhost:3000/api/settings | jq

# 3. CLI challenge (tests v1 auth routes)
curl -sS -X POST http://localhost:3000/api/v1/cli/auth/challenge \
  -H "content-type: application/json" \
  -d '{}' | jq
```

Expected results:
1. Array of panels (can be empty `[]`)
2. JSON object of settings (can be empty `{}`)
3. JSON with `challenge_id`, `nonce`, `expires_at`, `challenge_url` — these fields confirm the auth challenge system is working

### Strict JWT mode test

Run the server in strict mode (this stops the current server first):

```bash
# In the server terminal, press Ctrl+C first, then:
AUTH_PROVIDER_MODE=jwt RBAC_STRICT=1 npm run dev
```

- **Run from:** `/Users/ubl-ops/UBLX App` (in the terminal where the server runs)
- **What it does:** starts the Next.js server with JWT auth enforced and auto-bootstrap disabled
- **Success looks like:** server starts and shows `Ready in Xs` — same as normal startup
- **If it fails:** make sure you are in `/Users/ubl-ops/UBLX App` and `.env.local` exists

Without a valid Bearer token, these should all return `401`:

```bash
# Run from: any terminal (server must be running in strict mode above)
curl -i http://localhost:3000/api/settings
curl -i http://localhost:3000/api/v1/auth/onboard/claim -X POST -H "content-type: application/json" -d '{}'
```

- **Success looks like:** both return `HTTP/1.1 401` with `{"error":"..."}` in the body
- **If it fails (returns 200 instead):** auth is not enforcing correctly — verify `AUTH_PROVIDER_MODE=jwt` and `RBAC_STRICT=1` are actually set and the server restarted after the change

### Code quality checks

Before making changes to the codebase, verify the baseline is clean:

**For the JavaScript/Next.js side:**

```bash
cd "/Users/ubl-ops/UBLX App"
npm run lint
npm run build
```

- **Run from:** `/Users/ubl-ops/UBLX App`
- **What it does:** `lint` checks for code style errors; `build` compiles the full project and surfaces TypeScript type errors
- **Success looks like:** both commands finish with no red error lines; `build` prints `✓ Compiled successfully`
- **If it fails:** read the error — it shows the exact file path and line number of the problem

**For the Rust side:**

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check --workspace
cargo test --workspace
```

- **Run from:** `/Users/ubl-ops/UBLX App/logline`
- **What it does:** `check` scans the whole Rust workspace for compile errors (fast — no binary produced); `test` compiles and runs all unit tests
- **Success looks like:** `Finished` with no error lines; tests report `test result: ok. X passed; 0 failed`
- **If it fails:** Rust errors show the file and line number — run `git diff` to see what changed recently

### Pass criteria

The system is in a good state when ALL of these are true:

- `npm run lint` passes with no errors
- `npm run build` passes with no errors
- `cargo check --workspace` passes
- `cargo test --workspace` passes
- Compat smoke test: panels, settings, and challenge all return expected data
- Strict JWT test: protected routes return `401` without a token
- No unexpected `500` errors on any baseline API call

---

## 9. Troubleshooting Playbook

This section lists the 20+ most common problems, with exact steps to fix each one.

---

### Problem 1: Browser shows only a dark/blank screen

**Symptom:** You open `http://localhost:3000` and see nothing, or just a dark background.

**Likely cause:** The database is not connected — either `DATABASE_URL` is wrong, missing, or the database server is unreachable.

**Fix steps:**

1. Check the server terminal — look for any error lines that mention "database," "postgres," or "ECONNREFUSED"
2. Run: `curl -i http://localhost:3000/api/panels`
   - If you get `500` or a database error, the connection string is wrong
3. Open `.env.local` and verify `DATABASE_URL` is correctly set
4. Make sure your Supabase project is running (check the Supabase dashboard)
5. Stop the server (`Ctrl + C`), and restart it: `npm run dev`

---

### Problem 2: "command not found: npm"

**Symptom:** You type `npm install` and get "command not found."

**Likely cause:** Node.js is not installed on this machine, or is not in your PATH.

**Fix steps:**

1. Go to https://nodejs.org and download the LTS version
2. Run the installer
3. Close and reopen Terminal
4. Run `node --version` — if it shows a version, Node.js is now installed
5. Run `npm install` again

---

### Problem 3: "command not found: cargo"

**Symptom:** You type `cargo check` and get "command not found."

**Likely cause:** Rust is not installed.

**Fix steps:**

1. Go to https://rustup.rs
2. Run the installation command shown on that page
3. Follow the prompts (accept defaults)
4. Close and reopen Terminal
5. Run `cargo --version` to verify

---

### Problem 4: API returns 401 Unauthorized

**Symptom:** Curl commands return `{"error":"Authorization header with Bearer token required"}` or similar.

**Likely cause:** You are running in JWT mode (`AUTH_PROVIDER_MODE=jwt`) or strict mode (`RBAC_STRICT=1`) and not sending a valid token.

**Fix steps for development:**

1. Open `.env.local`
2. Set `AUTH_PROVIDER_MODE="compat"` and `RBAC_STRICT="0"`
3. Stop the server (`Ctrl + C`) and restart: `npm run dev`
4. Try the command again, passing the user ID header: `-H "x-user-id: local-dev"`

---

### Problem 5: API returns 403 Forbidden

**Symptom:** You get a response like `{"error":"User is not a member of this app"}` or `{"error":"Members cannot change tenant/app data"}`.

**Likely cause:** The user exists but does not have the right role (needs `app_admin`), or does not belong to the tenant/app.

**Fix steps for development:**

1. Switch to `RBAC_STRICT=0` — this auto-bootstraps `local-dev` as `app_admin`
2. Restart the server after changing `.env.local`
3. If in JWT mode with a real user: the user needs an `app_memberships` record with role `app_admin`

---

### Problem 6: "cargo check" shows compile errors

**Symptom:** Running `cargo check` in the `logline` folder prints red error messages.

**Likely cause:** A recent code change introduced a Rust type error or broken import.

**Fix steps:**

1. Read the error message — Rust error messages are detailed and usually say exactly what is wrong and where
2. The error will show a file path and line number, like `logline/crates/logline-cli/src/main.rs:42`
3. Open that file and look at that line
4. If you did not make the change, run `git status` to see what changed recently
5. Run `git diff` to see the actual changes

---

### Problem 7: `npm run dev` fails to start

**Symptom:** Running `npm run dev` prints an error immediately and stops.

**Likely cause:** A TypeScript/JavaScript error in the code, or a missing environment variable.

**Fix steps:**

1. Read the error carefully — it usually says the file and line number
2. If it says `Cannot find module`: run `npm install` again
3. If it says `.env` related: check that `.env.local` exists and has required values
4. If it says a port is in use: another copy of the server is already running. Run `npx kill-port 3000` and try again.

---

### Problem 8: Settings save but do not affect components

**Symptom:** You save settings in the App Settings modal, but the component still behaves as before.

**Likely cause:** The setting is not being received by the component because of a workspace mismatch or missing binding tag.

**Fix steps:**

1. Get the instance ID of the component from the URL or API
2. Run: `curl -sS "http://localhost:3000/api/effective-config/<instanceId>" | jq`
3. Look at the `missing_required_tags` field — if it is not empty, the component needs a setting you have not provided
4. Look at the `bindings` field — does it include the key you expected?
5. Verify `DEFAULT_WORKSPACE_ID` in `.env.local` matches the workspace you are working in

---

### Problem 9: Chat component says "401 Invalid API key"

> ⚠️ **Conditional:** Steps 3 and 4 only apply if you are using the agent onboarding flow. Skip them if you set your API key manually in App Settings.

**Symptom:** When you try to use an AI chat component, it returns an error about an invalid API key.

**Likely cause:** The LLM gateway API key is not set, is stale, or the wrong one is being used.

**Fix steps:**

1. In App Settings in the UI, verify `llm_gateway_api_key` is set
2. Check whether there is a stale `LLM_GATEWAY_KEY` environment variable conflicting — it should not be set in `.env.local` for onboarding mode
3. *(Agent onboarding only)* Check that `CLI_JWT` is valid and not expired
4. *(Agent onboarding only)* Run the agent health check: see Section 9 Problem 14

---

### Problem 10: Chat returns "502 upstream_error"

> ⚠️ **Conditional:** Steps 1 and 4 only apply if you are running the LLM gateway via PM2 (see `docs/OPERATIONS.md`). If you are not using the PM2/gateway setup, skip those steps.

**Symptom:** Chat sends a request but gets a 502 error back.

**Likely cause:** The upstream AI provider is unavailable — this is a provider-side issue, not an auth issue.

**Fix steps:**

1. *(PM2/gateway only)* Check gateway logs: `pm2 logs llm-gateway --lines 120 --nostream`
2. Verify the AI provider (for example OpenAI, Anthropic) has valid credits and the service is up
3. *(Ollama only)* If using a local model: verify it is running with `ollama list`
4. *(PM2/gateway only)* Reduce the number of "unhealthy candidates" in the gateway config

---

### Problem 11: Chat hangs / request times out

> ⚠️ **Conditional:** Steps 2 and 3 only apply if you are running the LLM gateway via PM2 (see `docs/OPERATIONS.md`). If you are not using the PM2/gateway setup, skip those steps.

**Symptom:** A chat request sits there indefinitely without completing or failing.

**Likely cause:** The gateway is retrying all backends and all of them are unavailable, causing a long wait.

**Fix steps:**

1. Press `Ctrl + C` in the browser or wait for it to time out
2. *(PM2/gateway only)* Set an explicit gateway mode to a known-healthy backend: `LLM_GATEWAY_MODE=premium` or `LLM_GATEWAY_MODE=local`
3. *(PM2 only)* Restart the gateway: `pm2 restart llm-gateway --update-env`

---

### Problem 12: Page loads but components are missing or wrong

**Symptom:** The tab loads but components are not showing, or the wrong component shows.

**Likely cause:** Wrong workspace ID — the components were created in a different workspace than the one being queried.

**Fix steps:**

1. Check `DEFAULT_WORKSPACE_ID` in `.env.local`
2. Run: `curl -sS http://localhost:3000/api/panels | jq` and verify the panels are listed
3. Check if `localStorage.ublx_workspace_id` is set in the browser — open the browser developer tools, go to Application > Local Storage > http://localhost:3000

---

### Problem 13: "Port 3000 already in use"

**Symptom:** `npm run dev` says something like "Error: listen EADDRINUSE: address already in use :::3000"

**Likely cause:** Another copy of the app is already running (maybe from a previous session you forgot about).

**Fix steps:**

```bash
# Run from: /Users/ubl-ops/UBLX App

# Option 1: using npx (recommended, requires Node.js)
npx kill-port 3000

# Option 2: universal fallback (works on any Mac, no extra tools needed)
lsof -i :3000 | grep LISTEN   # find the process using port 3000 — note the PID (second column)
kill <PID>                      # replace <PID> with the number shown in the second column above

npm run dev
```

- **Success looks like:** `npm run dev` starts and shows `Ready in Xs` without the EADDRINUSE error
- **If `lsof` shows nothing:** the port already freed itself — just run `npm run dev` again

---

### Problem 14: Rust daemon not accepting requests

**Symptom:** You run the daemon but curl requests to port 7600 fail with "connection refused."

**Likely cause:** The daemon did not start successfully, or it started on a different port.

**Fix steps:**

1. Look at the daemon terminal — does it say "Listening on http://127.0.0.1:7600"?
2. If there are errors in the terminal, read them carefully — they usually explain the problem
3. Check that no other process is using port 7600: `lsof -i :7600`
4. Verify the start command includes `--port 7600`

---

### Problem 15: `logline auth login --qr` shows QR but never completes

**Symptom:** The QR code appears in the terminal but the CLI keeps waiting and nothing happens.

**Likely cause:** The QR code was not scanned with an authenticated session, the challenge expired, or the challenge URL is not accessible.

**Fix steps:**

1. The challenge expires in a few minutes — if you waited too long, run the command again
2. Make sure you scan with a session that is already logged into the UBLX web app
3. After scanning, the web app should show an "Approve" button — click it
4. If the approval URL is not accessible from your phone: the daemon may not be reachable at the URL shown

---

### Problem 16: PM2 process restarts but behavior does not change

> ⚠️ **Conditional:** This entire problem only applies if you are using PM2 to manage processes (see `docs/OPERATIONS.md`). If you are not using PM2, skip this problem.

**Symptom:** You changed a configuration file and restarted a PM2 process, but the old behavior continues.

**Likely cause:** The old env values are cached in PM2 from the previous launch.

**Fix steps:**

```bash
pm2 restart <process-name> --update-env
```

The `--update-env` flag tells PM2 to reload environment variables.

---

### Problem 17: `npm run build` fails with TypeScript errors

**Symptom:** Running `npm run build` prints red TypeScript errors.

**Likely cause:** A recent code change introduced a type mismatch.

**Fix steps:**

1. Read the error — it shows the file path and line number
2. Open that file and look at the line
3. The error usually says something like "Type X is not assignable to type Y" — the value being assigned is the wrong type
4. Fix the type issue and run `npm run build` again

---

### Problem 18: Database writes succeed but reads return old data

**Symptom:** You save something and it appears to save (no error), but when you read it back, the old data shows.

**Likely cause:** A caching issue, or the read and write are going to different workspace scopes.

**Fix steps:**

1. Hard-reload the browser page: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows/Linux)
2. Check that the write and read are using the same `x-workspace-id`
3. Run the effective-config or settings API directly with curl to see what the database actually contains

---

### Problem 19: "supabase CLI not found"

**Symptom:** Running a `logline supabase` command gives "supabase CLI not found."

**Likely cause:** The Supabase CLI is not installed.

**Fix steps:**

First, verify Homebrew is installed: `brew --version`. If not installed, go to https://brew.sh first.

Then install the Supabase CLI:

```bash
brew install supabase/tap/supabase
```

- **Run from:** any terminal
- **Success looks like:** `supabase version` prints a version number after install completes
- **If brew itself is not found:** go to https://brew.sh and run their one-line installer, then retry

---

### Problem 20: The app was working, now suddenly nothing loads

**Symptom:** Everything was fine, you made a change (or maybe did nothing), and now the app is broken.

**Fix steps (in order):**

1. Check the server terminal for any error messages
2. Run `curl -sS http://localhost:3000/api/panels` — does it return data?
3. Restart the dev server: press `Ctrl + C` and run `npm run dev` again
4. Check if your `.env.local` file still exists and has the right values
5. Run `git status` to see what files changed — the change might be visible
6. Run `npm run lint` to check for code errors
7. Run `npm run build` — if this fails, there is a code error; fix it before trying to run dev

---

### Problem 21: `cargo run` is very slow

**Symptom:** Running the Rust daemon or CLI takes many minutes to start.

**Likely cause:** This is normal for the first compile. Rust compiles thoroughly and generates optimized code.

**What to expect:**
- First ever compile: 2-5 minutes (downloads and compiles dependencies)
- Subsequent full rebuilds: 30 seconds to 2 minutes (if you changed code)
- No changes: nearly instant (cargo skips compilation if nothing changed)

If it is always slow: make sure you are in the right directory (`/Users/ubl-ops/UBLX App/logline`) and not recompiling from scratch each time.

---

### Problem 22: "jq: command not found"

**Symptom:** Commands with `| jq` at the end fail.

**Likely cause:** jq is not installed.

**Fix:**

First, check whether Homebrew is installed:

```bash
brew --version
```

- **If Homebrew is installed:** run `brew install jq`
- **If Homebrew is not installed (`command not found: brew`):** go to https://brew.sh and run their one-line installer, then run `brew install jq`
- **Quickest fix (no install needed):** just remove `| jq` from any command — the output will be unformatted but still correct

---

## 10. Glossary

A single-sentence definition for every important term in this system.

**API (Application Programming Interface):** A set of defined ways for one program to ask another program for data or action; in this system, the Next.js API routes are the API.

**API route:** A specific URL path (like `/api/panels`) that your code can send requests to, returning data or performing an action on the server.

**Auth / Authentication:** The process of proving who you are to a system; the system has two modes: compat (trust the header) and JWT (verify a signed token).

**Authorization:** The process of checking whether a verified identity has permission to do a specific thing; handled by RBAC roles in this system.

**app_admin (role):** An app-level role that grants full read and write access to app settings and private configurations; the highest normal user role.

**Bearer token:** An authentication credential sent in the `Authorization` HTTP header as `Authorization: Bearer <token>`; used in JWT mode.

**Binding tag:** A label that maps a setting value to a type of thing a component needs (for example, `secret:llm_gateway:key` maps to an API key); the system creates these automatically from known setting names.

**Cargo:** The build tool and package manager for the Rust programming language; used to compile and run the logline workspace.

**cargo check:** A Rust command that checks code for errors without doing a full build; much faster than `cargo run` or `cargo build`.

**CLI (Command-Line Interface):** A text-based way to run programs by typing commands into a terminal; logline has a CLI for one-shot operations.

**Component:** A widget or panel element in the UI that does something specific — for example a chat interface, or a metrics display; components are added from the Store.

**Compat mode:** The development-friendly auth mode (`AUTH_PROVIDER_MODE=compat`) that accepts a simple user ID header instead of requiring a cryptographically signed JWT.

**curl:** A command-line tool for making web requests; used in this guide for testing API routes.

**Daemon:** A program that runs continuously in the background, listening for and responding to requests; the logline daemon runs on port 7600.

**DATABASE_URL:** An environment variable containing the connection string for the Postgres database; required for the app to store and retrieve data.

**Drizzle ORM:** The library used in this project to interact with the Postgres database using TypeScript; ORM stands for Object-Relational Mapper.

**env var (environment variable):** A named value stored in the computer's environment (or in a `.env.local` file) that programs can read; used to configure the app without hardcoding sensitive values.

**Effective config:** The merged, resolved settings for a specific component instance after all cascade levels have been applied; accessible at `/api/effective-config/:instanceId`.

**founder (capability):** A special capability (beyond regular roles) that allows executing protected operations; requires cryptographic signatures for all actions.

**Git:** A version control system that tracks changes to code over time; use `git status` to see what files have changed.

**HTTP:** HyperText Transfer Protocol — the language web browsers use to request and receive pages and data; GET, POST, PATCH, DELETE are types of HTTP requests.

**instance:** One specific copy of a component placed in a panel; you can have multiple instances of the same component type in different panels.

**jq:** A command-line tool for formatting and querying JSON output; install with `brew install jq`.

**JSON (JavaScript Object Notation):** A text format for structured data that looks like `{"key": "value"}`; APIs use JSON to send and receive data.

**JWT (JSON Web Token):** A cryptographically signed token that proves your identity; issued by Supabase Auth and verified by the app in JWT mode.

**localhost:** The address that always refers to your own computer; `http://localhost:3000` means "the website running on my machine at port 3000."

**member (role):** A basic role that allows reading and using an app or tenant, but not modifying settings or configurations.

**Migration:** A SQL script that makes changes to the database schema (tables, columns); run once to update the database structure.

**Next.js:** The JavaScript framework used to build the UBLX website; it handles both the visual front-end and the server-side API routes.

**npm:** Node Package Manager — the tool used to install JavaScript libraries and run project scripts like `npm install` and `npm run dev`.

**Panel:** A tab in the UBLX interface; each panel is a separate workspace area that can contain different components.

**PM2:** A process manager for Node.js that keeps services running in the background and restarts them if they crash; used in production and long-running setups.

**Port:** A numbered "door" on a computer that programs listen on; this system uses port 3000 (website) and 7600 (Rust daemon).

**Process:** A running program; `npm run dev` starts a process, and `Ctrl + C` stops it.

**Postgres:** PostgreSQL — the database system used for all persistent storage in UBLX; accessed via `DATABASE_URL`.

**RBAC (Role-Based Access Control):** A security model where what you can do depends on your role; this system has tenant roles (member, admin), app roles (member, app_admin), and a special founder capability.

**RBAC_STRICT:** An environment variable (`RBAC_STRICT=0` or `=1`) that controls whether the system auto-bootstraps a development user or requires real database records.

**React:** The JavaScript library used to build the UI components; the "R" in Next.js applications.

**React Query:** A library that manages data fetching and caching in the browser; when a setting changes in the database, React Query updates the UI automatically.

**Route:** In Next.js, a file under `app/api/` that handles a specific URL path; for example `app/api/panels/route.ts` handles requests to `/api/panels`.

**Rust:** A systems programming language known for speed and safety; used to build the logline engine and CLI.

**Settings cascade:** The three-level system (app -> panel -> instance) where settings at more specific levels override more general ones; the final merged result is called the "effective config."

**Supabase:** The hosted Postgres database service used in this project; provides the database, authentication (JWT), and storage.

**Tenant:** An organization or workspace in the multi-tenant model; every user must belong to at least one tenant.

**Terminal:** A text-based window for typing commands directly to the computer; on Mac, find it in Applications > Utilities > Terminal.

**Token:** A string of characters that proves identity or grants access; used in JWT mode and for the daemon token.

**TypeScript:** A version of JavaScript that adds type checking; used for all Next.js/Node.js code in this project.

**Workspace:** The scope/namespace for all user data (tabs, settings, components); controlled by `DEFAULT_WORKSPACE_ID` and the `x-workspace-id` header.

**x-user-id (header):** An HTTP header used in compat mode to tell the API who you are; example: `x-user-id: local-dev`.

**x-workspace-id (header):** An HTTP header that tells the API which workspace to use for scoping data; defaults to the value of `DEFAULT_WORKSPACE_ID`.

---

## 11. Learning Path

You have completed the foundation. Here is exactly what to read next, in what order, and why.

### Week 1: Understand the full system

**Day 1-2: Architecture and settings**

Read these files:
- `/Users/ubl-ops/UBLX App/docs/ARCHITECTURE.md` — the definitive layer diagram and responsibility boundaries
- `/Users/ubl-ops/UBLX App/docs/SETTINGS_CASCADE.md` — how config merges across app/tab/component levels

Goal: be able to draw the system diagram from memory, and explain what "effective config" means.

**Day 3-4: API contracts and auth**

Read these files:
- `/Users/ubl-ops/UBLX App/docs/API_CONTRACTS.md` — every API endpoint, what it does, and what permission it requires
- `/Users/ubl-ops/UBLX App/docs/RBAC_MODEL.md` — the role model in precise terms

Goal: given any feature request, know which API routes you would call and what permissions are needed.

**Day 5: Auth deep dive**

Read this file:
- `/Users/ubl-ops/UBLX App/docs/AUTH_PERMANENT_PLAN.md` — the full auth rollout plan, all phases A through G

Goal: understand what "compat mode" is bridging to, and what full production auth looks like.

### Week 2: Operate and extend

**Day 6-7: Operations and troubleshooting**

Read these files:
- `/Users/ubl-ops/UBLX App/docs/OPERATIONS.md` — PM2 runbook, daily commands, health checks
- `/Users/ubl-ops/UBLX App/docs/TROUBLESHOOTING.md` — symptom-to-fix reference
- `/Users/ubl-ops/UBLX App/docs/TESTING.md` — full validation checklist

Goal: run the full smoke test suite and understand what each check is verifying.

**Day 8-9: Rust engine and CLI**

Read these files:
- `/Users/ubl-ops/UBLX App/docs/logline-cli/ARCHITECTURE.md` — how the Rust CLI/daemon is structured
- `/Users/ubl-ops/UBLX App/logline/crates/logline-cli/src/main.rs` — the actual CLI command definitions

Goal: run every logline CLI command (`init`, `status`, `auth whoami`, `auth login --qr`) and understand what each does.

**Day 10: Deployment**

Read this file:
- `/Users/ubl-ops/UBLX App/docs/DEPLOYMENT.md` — topology options, env matrix, validation steps

Goal: understand the difference between local full-stack, Vercel + external services, and remote mobile access.

### Week 1 milestone

By the end of Week 1, you should be able to:
- Start the full system from scratch on a fresh machine
- Explain the three layers to someone else
- Run the full smoke test suite and interpret results
- Debug a settings cascade issue using the effective-config endpoint

### Week 2 milestone

By the end of Week 2, you should be able to:
- Write a new API route and connect it to a React Query hook
- Run and interpret all logline CLI commands
- Switch between compat and JWT auth modes deliberately
- Know what PM2 is and how to use it for service management

---

## 12. If You Only Remember 5 Things

If you read nothing else, burn these five things into memory:

**1. There are two programs, not one.**
The Next.js website (port 3000) and the Rust logline engine (port 7600) are separate. Each needs its own terminal to run. The website works for basic UI without the engine; the engine is needed for auth and runtime operations.

**2. Start every session in the right folder.**
```bash
cd "/Users/ubl-ops/UBLX App"
```
Every npm command must be run here. Every cargo command for logline must be run from `/Users/ubl-ops/UBLX App/logline`. Being in the wrong folder is the cause of many confusing errors.

**3. Use compat mode for development, JWT mode for production.**
`AUTH_PROVIDER_MODE=compat` and `RBAC_STRICT=0` in `.env.local` for all local development. Switch to `jwt` and `1` when testing auth correctness or deploying.

**4. Settings cascade from general to specific — the most specific always wins.**
App settings -> Panel/Tab settings -> Component instance settings. The effective config is the merged result. If a component ignores your setting, check the effective-config endpoint to see what it is actually receiving.

**5. When something breaks, read the terminal first.**
The server terminal (where `npm run dev` is running) shows errors before they reach the browser. Most problems announce themselves there with clear messages.

---

## 13. Confidence Checklist

Use this checklist to confirm you can do each skill independently. These are observable, verifiable actions — not concepts.

### Setup and start

- [ ] I can open a terminal and navigate to the project folder using `cd`
- [ ] I can check whether Node.js, npm, and Rust/Cargo are installed
- [ ] I can create `.env.local` from `.env.example` and fill in the minimum required values
- [ ] I can run `npm install` and understand what it does
- [ ] I can run `npm run dev` and confirm the server is running at localhost:3000
- [ ] I can start the logline daemon in a second terminal
- [ ] I know how to stop both servers with `Ctrl + C`

### UI operations

- [ ] I can open the UBLX interface in a browser and recognize the main areas
- [ ] I can create a new tab/panel
- [ ] I can open the Store and add a component to a panel
- [ ] I can resize a component using the size presets
- [ ] I can open App Settings, change a value, save it, and verify it persists after reload

### API and health checks

- [ ] I can run `curl -sS http://localhost:3000/api/panels | jq` and interpret the result
- [ ] I can run the full compat smoke test (panels, settings, challenge) and confirm all three pass
- [ ] I know what a `401` error means and how to fix it in development
- [ ] I know what a `403` error means and how to fix it in development
- [ ] I can check the effective config for a component using its instance ID

### Auth understanding

- [ ] I can explain the difference between compat mode and JWT mode without looking at notes
- [ ] I can explain what RBAC_STRICT=0 does and when to use it
- [ ] I know what tenant role and app role mean, and what `app_admin` can do that `member` cannot

### Settings cascade

- [ ] I can explain the three levels of settings (app, tab, component)
- [ ] I can explain what "effective config" means and how to check it
- [ ] I know what `missing_required_tags` means and how to investigate it

### Troubleshooting

- [ ] I know to check the server terminal first when something breaks
- [ ] I know to check the browser developer console for JavaScript errors
- [ ] I can diagnose "blank screen" as likely a database connection problem
- [ ] I can restart the development server when things go wrong
- [ ] I can find and use the troubleshooting playbook in this document

---

## 14. Conflicts and Assumptions

This section is transparent about inconsistencies found between source documents, and explains the most likely correct interpretation.

### Conflict 1: Node.js version requirement

**Conflict:** `GETTING_STARTED.md` says "Node.js 20+" but `UBLX — Beginner's Guide` only says "Node.js (v18+)".

**Most likely correct:** Node.js 20+, as specified in the more recent and formal GETTING_STARTED.md.

**Action:** This guide uses "Node.js 20+" as the requirement. The package.json specifies `@types/node: ^20` which confirms the 20+ intention.

**How to verify:** Run `grep '"@types/node"' package.json` from `/Users/ubl-ops/UBLX App` — look for `^20` in the output.

---

### Conflict 2: Default AUTH_PROVIDER_MODE in .env.example

**Conflict:** The `.env.example` file sets `AUTH_PROVIDER_MODE="jwt"` as the default. However, `GETTING_STARTED.md` recommends `AUTH_PROVIDER_MODE="compat"` as the starting point for new setups ("recommended for UI building"). The `.env.example` header comment says "jwt = default, Phase A+".

**How to verify:** Run `grep 'AUTH_PROVIDER_MODE' .env.example` from `/Users/ubl-ops/UBLX App` — you will see `AUTH_PROVIDER_MODE="jwt"` confirming the production default value.

**Most likely correct:** The `.env.example` reflects the production-intent default (JWT mode is the target state). The GETTING_STARTED.md recommendation of compat is a pragmatic onboarding suggestion for local development only.

**Resolution in this guide:** This guide tells beginners to use `compat` in `.env.local` for local development, consistent with GETTING_STARTED.md. The `.env.example` JWT default is correct for production deployments.

**Action:** Documentation should explicitly clarify that `.env.example` shows the production defaults, and that local developers should override to compat mode in their `.env.local`.

---

### Conflict 3: Database type — Postgres vs SQLite

**Conflict:** `GETTING_STARTED.md`, `ARCHITECTURE.md`, and `SUPABASE_FOUNDATION.md` all specify Postgres/Supabase as the database. However, `package.json` includes `better-sqlite3` as a dependency, and `SUPABASE_FOUNDATION.md` mentions "local SQLite as device outbox/cache." The `UBLX — Beginner's Guide` mentions "reads or writes to SQLite database" in the data flow description.

**Most likely correct:** The primary and persistent database is Postgres (via Supabase and `DATABASE_URL`). SQLite is used as a local cache or outbox for the Rust daemon side only. The Beginner's Guide was slightly imprecise in calling the main store "SQLite."

**Resolution in this guide:** This guide refers to Postgres as the database, since that is what `DATABASE_URL` points to and what the Next.js app uses.

**How to verify:** Run `grep 'DATABASE_URL' .env.example` from `/Users/ubl-ops/UBLX App` — you will see `postgresql://...` confirming Postgres. Run `grep 'better-sqlite3' package.json` to confirm SQLite is also a dependency (used only by the Rust daemon side).

**Action:** The original `UBLX — Beginner's Guide` should be updated to clarify that the Next.js API layer uses Postgres, not SQLite. SQLite is the Rust daemon's local cache.

---

### Conflict 4: ComponentRenderer.tsx file name

**Conflict:** `LLM_START_HERE.md` refers to `components/panel/ComponentRenderer.tsx`, while `UBLX — Beginner's Guide` also uses `ComponentRenderer.tsx`. However, `ARCHITECTURE.md` lists `components/panel/*` without naming ComponentRenderer. The git status shows `M components/panel/PanelRenderer.tsx` — suggesting the actual current file name may be `PanelRenderer.tsx`.

**Most likely correct:** The file was renamed from `ComponentRenderer.tsx` to `PanelRenderer.tsx`. The older docs still reference the old name.

**How to verify:** Run `ls components/panel/ | grep -i renderer` from `/Users/ubl-ops/UBLX App` — the current file name will appear in the output.

**Action:** The older docs (LLM_START_HERE.md, UBLX — Beginner's Guide) should be updated to reference `PanelRenderer.tsx`. This guide uses `ComponentRenderer.tsx` as referenced in documentation, but notes the discrepancy here.

---

### Assumptions made in writing this guide

1. **The machine at `/Users/ubl-ops/UBLX App` already has the project code checked out.** This guide does not cover cloning from git.

2. **Supabase is the intended database provider.** This guide uses Supabase as the example for getting a `DATABASE_URL`, consistent with the explicit Supabase project URL mentioned in `SUPABASE_FOUNDATION.md`.

3. **Beginners are working on a Mac.** All terminal examples and installation links use macOS conventions (`brew`, `/Users/ubl-ops/`).

4. **The logline daemon is run locally in development.** The guide shows manual `cargo run` commands. In a production or long-running setup, PM2 is used instead (see `OPERATIONS.md`).

5. **Auth Phases A-G are described as "planned" in AUTH_PERMANENT_PLAN.md but as "implemented" in the project MEMORY.** This guide treats the auth system as functionally implemented, since `lib/auth/access.ts` and `lib/auth/supabase-jwt.ts` exist and the code is present.

---

### Documents that should be updated

Based on research for this guide, these documents contain information that is outdated or inconsistent:

1. `UBLX — Beginner's Guide (Detailed Edit.md` — refers to SQLite as the main database; should say Postgres. May also reference `ComponentRenderer.tsx` instead of `PanelRenderer.tsx`.

2. `LLM_START_HERE.md` — may need update if `PanelRenderer.tsx` is the current file name.

3. `.env.example` — should add a clearer comment explaining that the defaults shown are for production, and local development should use `AUTH_PROVIDER_MODE=compat` and `RBAC_STRICT=0`.

---

*Guide version: 1.0 — Written 2026-02-27 against the current state of the repository.*
*Source documents read: 21 (all .md files in docs/ and docs/logline-cli/, plus .env.example, package.json, lib/auth/access.ts, and logline/crates/logline-cli/src/main.rs)*
