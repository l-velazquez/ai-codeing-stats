# Getting started

[Documentation index](index.md)

## Requirements

The supported desktop target is macOS. Development needs Node.js and npm compatible with the versions in `package-lock.json`; the repository does not pin a Node version. Use `npm ci` to reproduce the locked dependency tree.

Agent CLIs are optional for launching azul-code. Usage appears only when supported local agent files exist. OpenCode ingestion additionally invokes `sqlite3`. GitHub access is optional and separate from local usage; the Contributions page does not need the `git` executable.

## Run from source

From the repository root:

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

## Build a desktop package

```bash
npm run dist:mac
```

This typechecks, builds, verifies required bundles/assets, and creates DMG and ZIP artifacts in `release/`. Open the DMG and install the app in Applications. The repository configures packaging but does not document a signing/notarization release pipeline; a successful build alone is not evidence that an artifact is notarized.

Development and packaged runs normally share preferences under `~/Library/Application Support/azul-code/`.
