# User guide

[Documentation index](index.md)

## Navigation and ranges

The app opens on Overview. Use the sidebar for Overview, Plans, Models, Projects, Sessions, and Contributions. **⌘B** toggles the sidebar; **⌘,** opens Settings. The sidebar state survives relaunch. Settings can also be opened from the sidebar or menu bar panel.

The 7d, 30d, 90d, and All controls filter local usage. Timed ranges are rolling periods, not whole calendar weeks or months. Contributions has its own month selector. The dashboard currently starts at 30d on each launch; the settings schema's range field is not wired to restore the selection.

Refresh updates local usage on the usage pages. On Contributions it refreshes the selected GitHub month. Local usage updates about a second after a provider writes to disk: azul-code watches the transcript directories and rescans only what changed, so an idle machine does almost no work. A slower poll runs behind that, at local midnight, and after wake. Changing a range projects the cached records into that range.

## Overview

Start with remaining subscription allowance, then inspect API-equivalent usage, monthly pace, processed tokens, cache hit rate, cache savings, and average session cost. The usage chart, activity calendar, provider breakdown, model highlights, and project highlights provide different views of the same local records. **Last 14 days** puts AI spend and GitHub commits on the same day axis, with today's figures on top; click a day to open Contributions.

Dollar amounts are estimates of API-equivalent activity, not your subscription bill. Monthly pace uses a trailing 30-day window independently of the selected range. See [calculation definitions](data-and-calculations.md).

## Plans

Plans shows provider-reported Codex and Claude allowance windows and their reset times. It also offers Claude connection setup. Refreshing reads available provider reports; it cannot make an idle agent produce a fresh report. Allowance percentages are independent of local token-cost estimates.

## Models

The featured models and complete ledger show cost, token volume, cache efficiency, savings, and session counts by provider and model. Ordering is by cost, then token volume. Unknown models remain visible even when their usage cannot be priced.

## Projects

The project ledger groups usage by workspace path. Click a project row to open its path with macOS. Missing workspace metadata appears as **Unassigned**. Projects are sorted by cost, then tokens, so the “Most active” headline refers to that ordering, not elapsed work time. Identical folder names at different paths remain separate projects. When GitHub is connected, each row also shows commits for the matching repository over the same range and the AI cost per commit; matching uses the workspace's git remote first and its folder name second.

## Sessions

Search the session ledger by project, displayed model label, or provider. Search is case-insensitive. Sessions are ordered by most recent usage. A session using multiple models displays a model count. The session's times and totals reflect only records inside the selected range, not necessarily its complete lifetime.

## Contributions

Use the arrows to browse months through the current month. The month ribbon at the top shows commits and AI spend for every day of the month; hover a day for its figures and click it to jump to that day. Below it are your streak, AI cost per commit, commits per active day, and spend-only days. The ledger shows commit subjects and pull requests grouped by local day, collapsed to a summary line except for the latest day; click a header to expand it, or use **Expand all**. The side panels show when in the week you commit and per-project totals with a day-by-day strip. Links open GitHub in your browser. A previous month's data stays visible but dimmed while the next month loads.

**Oldest first / Newest first** reverses the day ledger, and the choice survives relaunch. It affects the day cards only: the ribbon stays a calendar, and the copy summary stays chronological.

**Copy invoice summary** opens a panel listing the month's projects. Untick personal projects to leave them out (the choice is remembered), choose **By project** — each project with a one-line description and its commits — or **By day**, then copy. Day cards also support copying a single day. The summary includes commit subjects, pull request titles, repository names, and totals. It does not calculate billable hours or invoice amounts. Review the text before sharing, especially for private repositories.

Daily AI cost is matched by date across your full local history. It is not attributed to a particular GitHub repository or proof that AI produced a commit. GitHub activity is fetched at app startup as well as through Contributions when credentials are available.

## Menu bar

The macOS companion defaults to today's USD API equivalent. Click for today's cost, tokens, commits pushed today, provider breakdown, remaining allowances, reset times, Refresh, dashboard/Settings shortcuts, and Quit. Right-click opens a native quick-action menu.

In **Settings → Menu bar**, enable or disable the companion and choose cost, allowance, both, or icon only. For allowance, choose Codex or Claude and the short or weekly window. The title names the provider in full, as in `Codex 5h · 80% left`. A period such as `5h` is the length of the allowance window, not the time left in it, and percentages mean **remaining** allowance.

| Display | Meaning |
| --- | --- |
| `$0.00` | A connected source has no priced cost today |
| `<$0.01` | Positive cost below one cent |
| `*` after cost | Partial pricing, source error, refresh failure, or snapshot older than two minutes |
| `—` for cost | No available connected source or no current-day summary |
| `—` for allowance | No provider window has been captured yet |

Today's Codex and Claude totals include events after local midnight even if the session began yesterday. OpenCode supplies session totals and has less precise daily attribution; see the data reference.

Closing the dashboard leaves the macOS app running. Reopen it from the Dock or menu bar. **Quit azul-code** exits the process. Disabling the companion removes its icon; it does not quit the app.

## Settings

Appearance offers Dark, Light, or System mode, plus red, orange, green, blue, pink, or violet accents — or Custom, a picker that recolours the entire page from any colour you choose (saturation/value field, hue bar, and hex entry). The derived roles stay readable in both themes. These preferences apply to the dashboard and menu bar panel; the Dock icon remains blue.

System check reports GitHub access and the availability of Git and supported agent CLIs. Its setup links open external documentation; the app does not install tools automatically. Data sources shows paths and scan status. A connected source means its location was discovered, not that every file was successfully parsed.
