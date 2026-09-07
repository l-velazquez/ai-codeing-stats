# azul-code

azul-code is a private, local-first macOS dashboard for AI coding usage. It reads token metadata already written by your coding agents and turns it into API-equivalent cost, cache, model, project, and session analytics.

The app never reads prompt text into its dashboard, does not require an API key, and does not send usage history to a server.

## Documentation

Start with [Getting started](docs/getting-started.md) or the [User guide](docs/user-guide.md).
The [documentation index](docs/index.md) also covers [data and calculations](docs/data-and-calculations.md), [privacy and storage](docs/privacy.md), [architecture](docs/architecture.md), [development](docs/development.md), and [troubleshooting](docs/troubleshooting.md).

## What is included

- Native macOS Electron app that opens on your remaining subscription allowance
- Live Codex, Claude Code, and OpenCode discovery
- 7-day, 30-day, 90-day, and all-time ranges
- Input, cached input, cache creation, output, and reasoning token accounting
- Standard API-price equivalents, cache savings, and monthly pace
- Model, project, provider, and per-session breakdowns
- Live Codex and Claude Code short-window and weekly subscription allowance, including reset times
- Searchable session ledger and click-to-open project paths
- Monthly GitHub contributions ledger: day-by-day commits and pull requests grouped by project (oldest or newest first, your choice), a month heat grid, per-project totals, and one-click copy of an invoice-ready summary (uses your existing `gh` CLI sign-in or a `GITHUB_TOKEN`; nothing leaves your machine but the GitHub API reads)
- Data-source health, plus dark, light, and follow-the-system themes reachable from every page
- A macOS menu bar companion with today's API equivalent, tokens, provider costs, and remaining subscription allowances

## Menu bar

azul-code's menu bar icon shows today's API-equivalent cost in USD by default. Click it for a compact breakdown, remaining allowances and reset times, a refresh button, and shortcuts to the dashboard and Settings. Right-click for a native quick-action menu.

In **Settings → Menu bar**, choose cost, allowance, both, or icon only; select the allowance provider and short or weekly window; or turn the companion off. `Cx` means Codex and `Cl` means Claude Code. Percentages show **remaining** allowance. A `*` beside a dollar amount means partial pricing, a source read error, or a stale estimate. Unavailable or stale allowance readings show `—`; using the agent produces a new provider report. Reports older than 15 minutes, or past their reset time, are treated as stale.

Usage refreshes once a minute through one shared background service, on opening the panel, at local midnight, and after waking the Mac. Closing the dashboard keeps the menu bar running. **Quit azul-code** exits the app. Today's Codex and Claude totals count individual usage events since local midnight, including sessions that began yesterday. OpenCode supplies session-level totals attributed to the session's latest timestamp; see [source limitations](docs/data-and-calculations.md#local-sources).

For a browser preview of the panel, run `npm run dev:web` and open `http://localhost:4317/?view=menubar`. The existing `&state=fresh`, `&state=waiting`, `&state=empty`, and `&state=error` previews work here too.

On macOS, `npm run test:menubar` exercises the compiled app with isolated temporary preferences. It verifies the native tray, preload bridge, panel layout, themes, display settings, background refresh with the dashboard closed, reopening Settings, and disabling/re-enabling the companion. Dark and light screenshots are saved to the temporary path printed by the test. It reads the same local usage sources as the app.

## Local prerequisites

azul-code's **Settings (⌘,) → System check** reports whether GitHub access, Git, Codex, Claude Code, and OpenCode are available. Missing tools link to their official setup guides; azul-code does not install command-line tools automatically.

The Contributions page does **not** require the `git` executable. It reads the GitHub API and needs one of these authentication methods:

- Install [GitHub CLI](https://cli.github.com/), then run `gh auth login`.
- Launch azul-code with a `GH_TOKEN` or `GITHUB_TOKEN` environment variable.

Git is checked as an optional developer tool. Codex, Claude Code, and OpenCode are also optional: azul-code shows analytics for whichever agents have written supported local usage metadata.

## Run it

```bash
npm install
npm run dev
```

The development command explicitly clears `ELECTRON_RUN_AS_NODE`, which lets it work when launched from inside another Electron-based coding tool.

To build the macOS installer:

```bash
npm run dist:mac
```

The `.dmg` and `.zip` are written to `release/`.

The app icon is generated from `resources/icon.svg` (full glyph) and
`resources/icon-small.svg` (simplified art for 16 and 32pt). After editing
either, regenerate the iconset, `.icns` and `resources/icon.png`:

```bash
./scripts/generate-icons.sh
```

It needs `rsvg-convert` (`brew install librsvg`).

## Verify it

```bash
npm run typecheck
npm test
npm run build
```

To iterate on the interface without Electron, `npm run dev:web` serves the
renderer on port 4317 against generated data. Append `?state=` to reach the
states that are otherwise hard to produce on demand: `fresh` (nothing
connected), `waiting` (status line installed, awaiting its first report),
`empty` (connected, no recorded usage), and `error` (failing scan and
unauthenticated GitHub).

To run the optional scan against the providers installed on the current Mac:

```bash
RUN_LOCAL_SCAN=1 npx vitest --config vitest.config.ts run src/main/scanner.integration.test.ts
```

## Local sources

| Provider | Source |
| --- | --- |
| Codex | `~/.codex/sessions/**/*.jsonl` |
| Claude Code | `~/.claude/projects/**/*.jsonl` |
| OpenCode | `~/.local/share/opencode/opencode.db` |

Claude allowance monitoring uses Claude Code's official [`statusLine` JSON](https://code.claude.com/docs/en/statusline#available-data). From the home screen or the Plans page, **Connect Claude Code** installs a small local wrapper in `~/.claude/azul-code/` and updates `~/.claude/settings.json`. The wrapper preserves any existing status-line command and retains only the `rate_limits` object. It temporarily writes the full status-line input while extracting that object and forwarding input to the existing command; see [Privacy and local storage](docs/privacy.md#claude-connection-behavior). Claude Code supplies the first allowance after the next assistant response.

Codex fork copies and repeated token events are suppressed. Claude assistant blocks are de-duplicated globally by message/request identity. OpenCode's own reported cost is preferred when present.

## About the dollar amount

The dollar amount is an API-price equivalent: what the recorded text-token activity would approximately cost at standard public API list prices. It is not a subscription invoice and does not imply that ChatGPT, Codex, Claude, Cursor, or another plan charged that amount.

The bundled [pricing implementation](src/shared/pricing.ts) records a verification date of 2026-09-05. See [Data and calculations](docs/data-and-calculations.md#pricing) for rate lookup, long-context assumptions, and pricing coverage. Unknown models remain visible and are marked as partially priced instead of being assigned a guessed rate.

## Inspiration

azul-code is an independent app inspired by the information density and local-first ergonomics of [T3 Code](https://github.com/pingdotgg/t3code). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Appearance

The azul-code identity uses a six-arm rounded star and defaults to blue. Choose **Settings → Appearance** for red, orange, green, blue, pink, or violet accents, independently of Dark, Light, or System mode. Colors are saved on this Mac and shared with the menu-bar panel. azul-code uses the same identity for its app data, bridge, IPC channels, and Claude integration.

### Resource diagnostics

Open **Settings → Diagnostics** in the desktop app for live CPU, resident memory,
process groups, a 60-sample CPU chart, per-process details, and host power/thermal
state. Sampling runs once a second while the view is visible and can be paused.
The first sample after a collection gap warms up the CPU counter. Browser preview
shows an unavailable state instead of simulated measurements.

The monitor covers Electron-managed azul-code processes; external coding agents
and short-lived CLI subprocesses are excluded. Memory sums working sets and may
count shared pages more than once. Disk throughput is unavailable through these
counters. Collection time measures the native collector's wall time, with its
resource use included in the backend process.

After `npm run build`, run `env -u ELECTRON_RUN_AS_NODE electron scripts/smoke-diagnostics.cjs`
to verify native readings and capture dark/light screenshots with isolated preferences.
