# Getting started

[Documentation index](index.md)

## Requirements

The supported desktop target is macOS on Apple Silicon or Intel. Building needs Git and Node.js 22 (minimum 22.12) with npm. Node 22 is what CI tests; newer versions currently build too but print an `EBADENGINE` warning and are untested; `.nvmrc` selects Node 22, and `npm ci` reproduces the locked dependency tree. The [README](../README.md#1-install-the-requirements) lists ways to install Node. Node is only needed to build; the installed app does not use it.

Agent CLIs are optional for launching azul-code. Usage appears only when supported local agent files exist. OpenCode ingestion additionally invokes `sqlite3`. GitHub access is optional and separate from local usage; the Contributions page does not need the `git` executable.

## Install on your Mac

azul-code is not yet signed with an Apple Developer ID or notarized, so there is no installer to download: macOS blocks unsigned apps that arrive from the internet. Build it on the Mac that will run it. A locally built app carries no quarantine flag, so Gatekeeper does not check it and it opens normally.

```bash
git clone https://github.com/l-velazquez/ai-codeing-stats.git
cd ai-codeing-stats
npm ci
npm run dist:mac
open release/azul-code-*.dmg
```

Drag azul-code into Applications. This typechecks, builds, verifies required bundles and assets, and packages a DMG and ZIP for your Mac's architecture in `release/`. The packages carry only an ad-hoc signature, so they are for this Mac; a copy downloaded or AirDropped to another Mac is blocked. To update, quit azul-code, run `git pull`, `npm ci`, and `npm run dist:mac`, then install the newest DMG in `release/` over the old app. Preferences in `~/Library/Application Support/azul-code/` are kept.

Signed and notarized downloads on GitHub Releases are planned; [the release checklist](releasing.md) covers what that requires.

## Run from source

To develop azul-code, run it without packaging. From the repository root:

```bash
npm ci
npm run dev
```

The development command clears `ELECTRON_RUN_AS_NODE` so Electron starts as a desktop app even when launched from another Electron-based tool.

For a UI-only preview:

```bash
npm run dev:web
```

Open `http://localhost:4317`. This uses generated demo data, not your local agent history. See [preview states](development.md#browser-preview).

## Get your first real data

1. Run a session in Codex, Claude Code, or OpenCode under the same macOS user running azul-code.
2. Open azul-code and choose Refresh. Use **Settings → Data sources** to inspect detected locations and status.
3. Select **All** if your activity falls outside the default 30-day range.
4. For Claude subscription allowance, choose **Connect Claude Code** on Overview or Plans. Start or resume Claude Code, accept its trust prompt if shown, and send a message. Refresh after its next assistant response.

Local token history does not require an API key. Claude allowance connection is an additional setup step; it is not needed to read Claude usage history. Codex allowance comes from its existing local rate-limit events. OpenCode has no subscription allowance integration.

## Connect GitHub

With an installed GitHub CLI, run:

```bash
gh auth login
```

Then refresh Contributions. Alternatively, launch the app from an environment containing `GITHUB_TOKEN` or `GH_TOKEN`. The app must inherit that environment; a Finder launch may not inherit variables from your shell. Do not put credentials in the repository or documentation.

The app uses GitHub API reads with your existing access. See [coverage and limits](data-and-calculations.md#github-contributions) if the results differ from GitHub's profile contribution graph.

Development and packaged runs normally share preferences under `~/Library/Application Support/azul-code/`.
