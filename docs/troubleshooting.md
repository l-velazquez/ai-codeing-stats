# Troubleshooting

[Documentation index](index.md)

| Symptom | What to check |
| --- | --- |
| No usage appears | Open Settings → Data sources, run an agent session under the same macOS user, refresh, and try All |
| CLI is installed but source is missing | CLI discovery and history discovery are separate; verify the fixed source paths in the data reference |
| Connected source has no records | Empty/unsupported transcripts can still be connected; agent schema changes or a date filter can exclude records |
| Some cost is missing or marked partial | Inspect the unknown-model warning; unpriced records retain tokens but add zero cost |
| OpenCode shows an error | Check `sqlite3` availability and that the DB has the expected `session` schema; consult the source error detail |
| Project does not open | Its recorded workspace may have moved or been deleted; Unassigned has no known path |
| Claude says waiting | Start/resume Claude Code, accept trust if prompted, send a message, then refresh after a response |
| Claude cannot connect | Check that `~/.claude/settings.json` is valid JSON and writable; the installer refuses malformed settings |
| Allowance is stale or `—` | Use the relevant agent to generate a new report; expired windows and old reports cannot be renewed by dashboard refresh alone |
| Menu bar is absent | Enable it in Settings on macOS; it is not a native browser-preview feature |
| App keeps running after closing window | Expected macOS behavior; use Quit azul-code to exit |
| Preferences reset on relaunch | Check access to the Tally settings directory; corrupt/unreadable preferences fall back to defaults |
| GitHub asks for setup | Run `gh auth login` or launch with a token environment; refresh Contributions afterward |
| GitHub rejects credentials | Refresh CLI authentication; verify the app inherited any intended environment token |
| GitHub reports rate limiting | Wait before retrying; repeated forced refreshes bypass the ten-minute cache |
| GitHub totals differ from expectations | Check date/account, access, merge-subject exclusion, default-branch scope, pagination caps, and partial-result warnings |
| App fails when launched inside another coding tool | Use `npm run dev` or `npm run preview`, which clear `ELECTRON_RUN_AS_NODE` |
| Desktop bridge is missing | Run `npm run build`; confirm verification finds `out/preload/index.cjs` and the main bundle references it |

## Understanding stale data

The app preserves a previous successful snapshot when a later refresh fails. Read warning banners and the menu bar's `*`; visible totals are not proof that the last read succeeded. A first-load failure presents a retry state instead of a populated dashboard.

The native menu bar considers its summary stale after two minutes, while allowance reports also have a 15-minute freshness limit and provider reset times. These are separate from the ten-minute GitHub cache.

## Useful diagnostics

Run these from the repository to check the build or installed tool versions without printing credentials:

```bash
node --version
npm --version
sqlite3 --version
gh --version
npm run build
```

When reporting a problem, include macOS/app versions, the affected page/provider, selected range or month, the exact error, and whether it happens in Electron or browser demo. Share redacted source status and a minimal synthetic usage fixture when possible. Avoid attaching raw transcripts, settings containing secrets, tokens, private commit subjects, or full workspace paths unnecessarily.

For reset and manual Claude disconnect instructions, see [Privacy and local storage](privacy.md#reset-or-remove-app-owned-data).
