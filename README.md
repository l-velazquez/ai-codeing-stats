# Tokenary

Tokenary is a private, local-first macOS dashboard for AI coding usage. It reads token metadata already written by your coding agents and turns it into API-equivalent cost, cache, model, project, and session analytics.

The app never reads prompt text into its dashboard, does not require an API key, and does not send usage history to a server.

## What is included

- Native macOS Electron app with a compact T3 Code-inspired interface
- Live Codex, Claude Code, and OpenCode discovery
- 7-day, 30-day, 90-day, and all-time ranges
- Input, cached input, cache creation, output, and reasoning token accounting
- Standard API-price equivalents, cache savings, and monthly pace
- Model, project, provider, and per-session breakdowns
- Live Codex and Claude Code short-window and weekly subscription allowance, including reset times
- Searchable session ledger and click-to-open project paths
- Monthly GitHub contributions ledger: day-by-day commits and pull requests grouped by project, a month heat grid, per-project totals, and one-click copy of an invoice-ready summary (uses your existing `gh` CLI sign-in or a `GITHUB_TOKEN`; nothing leaves your machine but the GitHub API reads)
- Data-source health plus dark and light themes

## Local prerequisites

Tokenary's **Settings → System check** reports whether GitHub access, Git, Codex, Claude Code, and OpenCode are available. Missing tools link to their official setup guides; Tokenary does not install command-line tools automatically.

The Contributions page does **not** require the `git` executable. It reads the GitHub API and needs one of these authentication methods:

- Install [GitHub CLI](https://cli.github.com/), then run `gh auth login`.
- Launch Tokenary with a `GH_TOKEN` or `GITHUB_TOKEN` environment variable.

Git is checked as an optional developer tool. Codex, Claude Code, and OpenCode are also optional: Tokenary shows analytics for whichever agents have written supported local usage metadata.

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

## Verify it

```bash
npm run typecheck
npm test
npm run build
```

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

Claude allowance monitoring uses Claude Code's official [`statusLine` JSON](https://code.claude.com/docs/en/statusline#available-data). From the Plans page, **Connect Claude Code** installs a small local wrapper in `~/.claude/tokenary/` and updates `~/.claude/settings.json`. The wrapper preserves any existing status-line command and stores only the `rate_limits` object; session IDs, workspace paths, transcript paths, prompts, and tool output are not retained. Claude Code supplies the first allowance after the next assistant response.

Codex fork copies and repeated token events are suppressed. Claude assistant blocks are de-duplicated globally by message/request identity. OpenCode's own reported cost is preferred when present.

## About the dollar amount

The dollar amount is an API-price equivalent: what the recorded text-token activity would approximately cost at standard public API list prices. It is not a subscription invoice and does not imply that ChatGPT, Codex, Claude, Cursor, or another plan charged that amount.

The built-in table was last verified on 2026-08-29 against the [OpenAI model comparison](https://developers.openai.com/api/docs/models/compare) and [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) pages. Unknown models remain visible and are marked as partially priced instead of being assigned a guessed rate.

## Inspiration

Tokenary is an independent app inspired by the information density and local-first ergonomics of [T3 Code](https://github.com/pingdotgg/t3code). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
