# Privacy and local storage

[Documentation index](index.md)

## What the app reads

azul-code opens local agent transcript files and the OpenCode database to extract usage metadata. It retains normalized token counts, costs, models, timestamps, session IDs, and workspace paths in memory for the dashboard. Prompt text and tool output are not included in the dashboard data model.

“Metadata only” describes what is extracted and displayed. The scanner streams transcript lines, and parsing an assistant JSON record can temporarily bring other fields into process memory. It does not mean the underlying transcript bytes are never read.

## Files written

| Location | Purpose |
| --- | --- |
| `~/Library/Application Support/azul-code/settings.json` | Desktop preferences and window bounds |
| `~/Library/Application Support/azul-code/pricing.json` | Model prices from models.dev and when each was first seen; absent while live pricing is off |
| `~/.claude/settings.json` | Updated only when connecting Claude allowance capture |
| `~/.claude/azul-code/azul-code-statusline.sh` | Installed allowance wrapper |
| `~/.claude/azul-code/previous-statusline-command` | Previous status-line command, when one exists |
| `~/.claude/azul-code/rate-limits.json` | Last extracted allowance object |
| `~/.claude/azul-code/statusline-input.*` and `rate-limits.json.*` | Temporary wrapper input/output candidates |

Electron may also create normal runtime storage within its user-data directory. Browser previews use localStorage for demo preferences. Usage snapshots and GitHub month results are held in memory rather than an app-managed historical database.

Settings writes use a temporary file and rename with mode `0600`. Failed preference writes are best-effort: the current session may reflect a change that did not persist.

## Claude connection behavior

Connecting installs a shell wrapper and changes `statusLine.command`, preserving other settings fields and chaining an existing command with the original input. Symlinked settings are updated at their resolved target.

The wrapper temporarily writes the **full status-line input** to a restricted local file, extracts only `rate_limits` with macOS `plutil`, and removes temporary files through a shell trap. The retained capture contains only that allowance object. Abrupt termination can leave temporary files behind. An existing chained command receives the full input and retains its own behavior.

## Network and credentials

Local agent analytics require no azul-code account, API key, or usage-upload service. The app has no configured analytics endpoint or cloud usage database.

GitHub integration makes authenticated outbound reads to `api.github.com`, including at dashboard startup when credentials are available. The app resolves a token from `GITHUB_TOKEN`, then `GH_TOKEN` when the former is unset, or an existing `gh auth token` result. It does not save that token in azul-code settings. Repository names, commit subjects, and PR titles returned by GitHub are displayed locally. To match projects to repositories, azul-code runs `git remote get-url origin` in each workspace folder it has already seen in local transcripts; this reads only the remote URL, makes no network request, and the result stays in memory.

Live pricing, on by default, downloads the public catalog at `https://models.dev/api.json` at launch and then every six hours (every 15 minutes after a failed check, so arriving on a network does not wait hours), revalidating with its ETag so an unchanged catalog is not downloaded again. The request is an unauthenticated GET that carries no usage, account, or device data beyond what any HTTP request reveals, such as your IP address. Turn off **Settings → Model prices → Keep model prices up to date** to make no request and use only the bundled prices; the cached `pricing.json` is then ignored. With live pricing on and no connection, the last saved prices in `pricing.json` load at launch and stay in use.

Opening setup guides or GitHub links uses your external browser. Copying a contribution summary puts repository/activity details on the system clipboard. Projects you untick in the copy panel are stored by name in azul-code settings so they stay excluded. Installed tools and any existing Claude status-line command have their own network and storage behavior.

## Reset or remove app-owned data

Quit azul-code before changing its files. To reset desktop preferences, move `~/Library/Application Support/azul-code/settings.json` aside, then relaunch. Keep a backup if you want to restore appearance or window settings.

To disconnect Claude manually, first back up `~/.claude/settings.json`. If its status-line command still points to the azul-code wrapper, restore the command from `previous-statusline-command`; if no prior command existed, remove the azul-code `statusLine` configuration. Preserve unrelated settings and any later user changes. Only after disconnecting the command should you remove `~/.claude/azul-code/`. There is currently no in-app disconnect action.

Removing the app or its preferences does not remove provider transcripts and does not automatically disconnect the Claude wrapper. Do not delete agent history merely to reset azul-code preferences.
