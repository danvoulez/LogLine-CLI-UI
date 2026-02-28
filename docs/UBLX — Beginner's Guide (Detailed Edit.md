# UBLX — Beginner's Guide (Detailed Edition)

## 0) Fastest Possible Start (Copy/Paste)

```bash
# Terminal A: website
cd "/Users/ubl-ops/UBLX App"
npm install
npm run dev

# Terminal B: Rust daemon
cd "/Users/ubl-ops/UBLX App/logline"
LOGLINE_DAEMON_TOKEN=dev-token cargo run -p logline-daemon -- --host 127.0.0.1 --port 7600

# Terminal C (optional): verify daemon identity
cd "/Users/ubl-ops/UBLX App/logline"
LOGLINE_DAEMON_URL=http://127.0.0.1:7600 LOGLINE_DAEMON_TOKEN=dev-token \
cargo run -p logline-cli -- --json auth whoami
```

If these three blocks work, your environment is good.

---

## What even is this thing?

UBLX is two apps that work together as one system:

1. **A website** (built with Next.js) — this is the visual interface you interact with. It runs in your browser at `localhost:3000`.
2. **A background engine** (built in Rust, called `logline`) — this is the logic and data layer. It runs as a separate process and exposes its own API on port `7600`.

They are **independent but connected**. The website can work without the Rust engine for basic UI/database behavior. For runtime auth, identity, and daemon operations, you need both running.

Think of it like a restaurant:
- The **website** is the dining room — menus, tables, waiters
- The **`app/api`** folder is the kitchen pass — receives orders, coordinates
- The **Rust engine** is the actual kitchen — where real cooking happens

---

## Before You Start — What You Need Installed

Make sure you have these on your machine:

| Tool | What it's for | Check if installed |
|---|---|---|
| Node.js (v18+) | Runs the website | `node --version` |
| npm | Installs JS packages | `npm --version` |
| Rust + Cargo | Compiles the engine | `cargo --version` |

If any of those commands return "command not found", you need to install that tool first.

---

## Step 1 — Get into the project folder

Everything lives inside one master folder. Start every session by going there:

```bash
cd "/Users/ubl-ops/UBLX App"
```

From here you have two sub-worlds:
- `.` (current folder) — the Next.js website
- `./logline` — the Rust engine workspace

---

## Step 2 — Start the Website

### First time only:
```bash
npm install
```
This downloads all the JavaScript dependencies (like installing apps on a new phone). You only need to do this once, or after someone adds new packages.

### Every time:
```bash
npm run dev
```

Open your browser at **http://localhost:3000**

The terminal will stay busy while the app runs — that's normal. Don't close it.

### What you can do in the UI right now:

**Tab management**
- Create new workspace tabs
- Rename tabs to organize your work
- Delete tabs you don't need

**Component store**
- Open the Store to browse available components
- Add components to your current panel
- Remove components you don't want

**Layout control**
- Resize components using presets: `S`, `M`, `L`, `XL`, `WIDE`
- Components snap to a grid — you're not free-dragging, you're picking sizes

**Settings inheritance**
- Settings cascade from the app level down to individual components
- A component can override the panel's setting, which can override the app's default
- This means you can set a global default and only change what needs to be different

### Main files in the website (what they actually do):

**`app/page.tsx`**
The root of everything. This is the first file that runs when you open the browser. It sets up the overall layout and decides what to render.

**`components/shell/AppShell.tsx`**
The permanent outer frame — headers, footer/tab strip, store overlay, and persistent chrome that doesn't change when you switch tabs.

**`components/panel/GridCanvas.tsx`**
The actual working area inside a tab. This is the grid where components are placed and arranged. When you add something from the Store, it appears here.

**`components/panel/ComponentRenderer.tsx`**
A traffic director. It receives a component ID (like `"my-widget"`) and decides which React component to actually render. If you add a new widget to the system, you register it here.

---

## Step 3 — Start the Rust Engine

The Rust engine (`logline`) is a completely separate program. It has two modes:

- **CLI mode** — you run a command, it does something, it exits
- **Daemon mode** — it runs continuously in the background, listening for requests on port 7600

### First, verify it compiles:

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check
```

`cargo check` doesn't actually build the full binary — it just checks for errors. Much faster than a full build. If you see errors here, something is broken and needs fixing before going further.

### Run CLI commands (one-shot operations):

```bash
# Initialize the logline environment (first time setup)
cargo run -p logline-cli -- init

# Check current status
cargo run -p logline-cli -- status
```

The `--` separator tells Cargo "everything after this is an argument to the program, not to Cargo itself."

### Start the daemon (background service):

```bash
LOGLINE_DAEMON_TOKEN=dev-token cargo run -p logline-daemon -- --host 127.0.0.1 --port 7600
```

Breaking this down:
- `LOGLINE_DAEMON_TOKEN=dev-token` — sets a secret token the daemon requires for auth (in dev, we use `dev-token`)
- `cargo run -p logline-daemon` — compiles and runs the daemon package
- `--host 127.0.0.1` — only listen on localhost (not exposed to the internet)
- `--port 7600` — listen on port 7600

Once running, the daemon stays alive and responds to HTTP requests.

### Query the daemon (test that it's working):

```bash
LOGLINE_DAEMON_URL=http://127.0.0.1:7600 LOGLINE_DAEMON_TOKEN=dev-token \
cargo run -p logline-cli -- --json auth whoami
```

This tells the CLI to talk to the running daemon and ask "who am I?" — a basic identity check. If you get a JSON response back, everything is connected.

---

## Step 4 — How the Three Layers Talk to Each Other

Here's the full picture of a request flowing through the system:

```
[YOU]
  click a button in the browser
        ↓
[NEXT.JS FRONTEND]
  React component handles the click
  calls a React Query hook from lib/api/db-hooks.ts
        ↓
[NEXT.JS API ROUTES — app/api/*]
  receives the HTTP request
  reads or writes to SQLite database
  optionally calls the Rust daemon if needed
        ↓
[LOGLINE RUST DAEMON — port 7600]
  handles heavy logic, identity, contracts, runtime operations
  returns structured data
        ↓
[RESPONSE FLOWS BACK UP]
  API route returns JSON to the frontend
  React Query updates the UI automatically
```

### Settings inheritance in detail:

Settings flow from general to specific, and the most specific one always wins:

```
App-level defaults (app/api/settings/route.ts)
        ↓
Panel-level overrides (app/api/panel-settings/[panelId]/route.ts)
        ↓
Instance-level overrides (app/api/instance-configs/[instanceId]/route.ts)
```

The resolver that figures out the final effective config for any component is at:
`logline/crates/logline-daemon/src/main.rs` (`get_effective_config`)

And you can query it via:
`app/api/effective-config/[instanceId]/route.ts`

---

## Step 5 — How to Add New Things

### A) Add a new visual component (a new widget in the Store)

This is the most common thing you'll do. Here's the full process:

**1. Create the component file**

Make a new file in `components/component-catalog/`. For example:

```
components/component-catalog/MyWidget.tsx
```

Write a standard React component. It can accept a `config` prop if it needs settings.

**2. Register it in the mock catalog**

Open `mocks/ublx-mocks.ts` and add an entry like:

```ts
{
  component_id: "my-widget",
  name: "My Widget",
  version: "1.0.0",
  frontend_entry: "MyWidget",
  permissions: [],
  allowed_size_presets: ["S", "M", "L"],
  default_size_preset: "M",
  limits: { min_w: 4, min_h: 4, max_w: 16, max_h: 12 }
}
```

This is what the Store reads to know the component exists and what sizes it supports.

**3. Register it in the renderer**

Open `components/panel/ComponentRenderer.tsx` and add a case to the switch statement:

```ts
case "my-widget":
  return <MyWidget {...instance.front_props} />;
```

**4. Add settings support (if needed)**

If your widget needs to save/load settings, decide at which level:
- App-wide setting → `app/api/settings/route.ts`
- Per panel → `app/api/panel-settings/[panelId]/route.ts`
- Per component instance → `app/api/instance-configs/[instanceId]/route.ts`

Use the corresponding React Query hook from `lib/api/db-hooks.ts` inside your component to read and write settings.

---

### B) Add a new API endpoint

When you need new server-side logic that the frontend can call:

**1. Create the route file**

Next.js uses file-based routing. Create a file like:

```
app/api/my-feature/route.ts
```

Inside, export handler functions:

```ts
export async function GET(request: Request) { ... }
export async function POST(request: Request) { ... }
```

This automatically becomes available at `http://localhost:3000/api/my-feature`.

**2. Create a React Query hook**

Open `lib/api/db-hooks.ts` and add a hook that calls your new route:

```ts
export function useMyFeature() {
  return useQuery({
    queryKey: ['my-feature'],
    queryFn: () => fetch('/api/my-feature').then(r => r.json())
  });
}
```

**3. Use it in a component**

```ts
const { data, isLoading } = useMyFeature();
```

React Query handles caching, refetching, and loading states automatically.

**4. Update the database if needed**

If your feature needs a new table or column:
- Schema changes → `db/schema.ts`
- Initial data → `db/seed.ts`

---

### C) Add new Rust engine logic

**1. New CLI command**

Open `logline/crates/logline-cli/src/main.rs` and add a new subcommand to the CLI argument parser, then implement the handler function.

**2. New daemon endpoint**

Open `logline/crates/logline-daemon/src/main.rs` and add a new route to the HTTP router, then implement the handler.

**3. Update shared types/contracts if needed**

If you're changing what data structures are passed around:
- Shared API types → `logline/crates/logline-api/src/lib.rs`
- Runtime logic → `logline/crates/logline-runtime/src/*`
- Core primitives → `logline/crates/logline-core/src/lib.rs`

**4. Always validate after changes:**

```bash
cd "/Users/ubl-ops/UBLX App/logline"
cargo check
```

Never assume the Rust code is fine without running this. It will catch type errors, missing imports, and broken contracts before you even try to run anything.

---

## Step 6 — The Mental Model (One Page Version)

```
┌─────────────────────────────────────────────┐
│              YOUR BROWSER                   │
│         http://localhost:3000               │
│                                             │
│  Tabs → Panels → Components                 │
│  Store → Add/Remove widgets                 │
│  Settings cascade: app → panel → instance   │
└──────────────────┬──────────────────────────┘
                   │ HTTP fetch
┌──────────────────▼──────────────────────────┐
│           NEXT.JS API LAYER                 │
│              app/api/*                      │
│                                             │
│  Reads/writes SQLite                        │
│  Resolves effective config                  │
│  Bridges to Rust daemon when needed         │
└──────────────────┬──────────────────────────┘
                   │ HTTP on port 7600
┌──────────────────▼──────────────────────────┐
│          RUST ENGINE (logline)              │
│       http://127.0.0.1:7600                 │
│                                             │
│  Identity, auth, runtime logic              │
│  Contracts, spans, heavy computation        │
│  CLI for one-shot operations                │
└─────────────────────────────────────────────┘
```

**The one rule to remember:** if something feels like business logic or data integrity, it belongs in Rust. If it's about displaying or arranging things, it belongs in the website. The `app/api` layer is the translator between the two.
