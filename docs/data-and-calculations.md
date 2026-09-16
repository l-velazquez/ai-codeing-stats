# Data and calculations

[Documentation index](index.md)

## Local sources

| Provider | Fixed default source | Normalization |
| --- | --- | --- |
| Codex | `~/.codex/sessions/**/*.jsonl` | Session metadata and turn context identify model/workspace; token-count events supply request usage |
| Claude Code | `~/.claude/projects/**/*.jsonl` | Assistant message usage supplies counts, model, session, workspace, and optional `costUSD` |
| OpenCode | `~/.local/share/opencode/opencode.db` | `sqlite3 -json` reads metered rows from the `session` table |

Custom agent home directories and arbitrary import locations are not configurable in the current app. Sources are rescanned rather than imported into a permanent azul-code usage database. Removing source history changes future totals.

Malformed or irrelevant transcript lines are ignored. Individual transcript read failures are tolerated, including files rotating during a scan; source status can still say connected. OpenCode query failures become a source error.

Codex suppresses consecutive identical usage payloads and uses a timestamp-based heuristic to skip copied fork history. Claude deduplicates globally across scanned files using message/request identity; records without either identifier cannot use this deduplication. These are provider-specific heuristics, not a guarantee against every future transcript format change.

OpenCode is represented by one record per session, timestamped at `time_updated` (or `time_created`). All of that session's totals are attributed to that timestamp. Daily and range totals therefore cannot split OpenCode activity across days as precisely as transcript events.

## Token accounting

| Field | Meaning |
| --- | --- |
| `uncachedInput` | Input excluding cache reads and writes where the provider reports inclusive input |
| `cachedInput` | Input served from cache |
| `cacheWrite5m` / `cacheWrite1h` | Cache creation buckets; Claude distinguishes their lifetimes |
| `output` | Output tokens, including reasoning where reported inclusively |
| `reasoning` | Informational subset of output; never added again to total tokens or price |

Total tokens = uncached input + cached input + both cache-write buckets + output. Cache hit rate = cached input / all input buckets, or zero when no input exists.

Claude input is already exclusive of cache buckets. Codex and OpenCode subtract cache reads/writes from inclusive input, clamping uncached input to zero. Claude's available one-hour cache writes are separated from the remaining five-minute creation count.

## Pricing

The source of truth is [`src/shared/pricing.ts`](../src/shared/pricing.ts). Rates are USD per million tokens and are bundled with the app, not downloaded at runtime. Its verification comment records existing rates as of 2026-09-05 and Claude Fable rates as of 2026-09-14; these dates are repository metadata, not a fresh independent verification of provider prices. See [Anthropic's current pricing table](https://platform.claude.com/docs/en/about-claude/pricing) for the Fable model rates.

A finite nonnegative provider-reported cost takes precedence over the rate table, including zero. This applies to OpenCode costs and Claude `costUSD`. Such records count as priced and contribute zero calculated cache savings.

Otherwise, each token bucket is multiplied by its model rate and divided by one million. Lookup trims whitespace, lowercases the model, and strips a provider prefix before the last slash. It requires an exact remaining model key; dated variants do not automatically inherit a price.

Unknown models contribute tokens and sessions but zero estimated cost, with partial-pricing warnings. `pricedPercent` measures priced **records**, not the share of tokens or dollars covered.

For configured long-context models, input above the threshold applies the higher rates to the entire record: 2× input/cache rates and 1.5× output. The current GPT threshold is 272,000 input tokens. The implementation explicitly assumes this tier shape for some GPT models; treat it as an estimate and verify assumptions before changing the table.

Cache savings compares cache-read/write cost with charging those same tokens at the uncached input rate. Negative savings are clamped to zero per record, so this is not a complete measure of net cache economics across requests.

## Aggregation and dates

Usage ranges filter record timestamps from `now − N × 24 hours` through now. All includes available history. Daily buckets use the Mac's local calendar date and include zero-activity days. A rolling seven-day period can touch eight calendar dates.

Sessions group by provider and session ID, falling back to timestamp if the ID is absent. Models group by provider/model; projects group by exact workspace path. Session counts across daily or model rows are not additive: the same session can appear in multiple buckets.

Average session cost divides selected-range cost by selected-range session count. Active days counts days containing records. Session start/end are the earliest/latest included usage events, not a timer measuring hands-on work.

Monthly pace uses cost in the trailing 30-day window, divided by elapsed days since the first record within that window (clamped to 1–30 days), multiplied by 30. It is independent of the range selector and can fluctuate with sparse history. It is a projection, not a billing forecast.

## Subscription allowance

Codex uses the newest local rate-limit event. Claude reads captured five-hour and seven-day windows, using the capture file's modification time as report time. No token-to-quota conversion is attempted. A report stays visible after it becomes old; once its known reset timestamp passes, the UI resets that window to 0% used locally without waiting for another provider event. Refresh can read a newer report but cannot create one without agent activity.

## GitHub contributions

The implementation in [`github.ts`](../src/main/github.ts) reads the authenticated user, accessible repositories, authored commits, and authored pull requests from `api.github.com`. It does not scan local Git repositories.

- Repository discovery considers up to 500 accessible owner/collaborator/organization repositories, sorted by last push, and filters out those not pushed since the selected month began.
- Commit requests filter by authenticated author and month. They do not specify a branch, so this is not an all-branch history scan.
- Each paginated read is capped at 10 pages of 100 items. Repository reads run with concurrency six.
- Commit subjects beginning with common `Merge pull request`, `Merge branch`, `Merge remote-tracking branch`, or `Merge tag` patterns are excluded.
- Pull requests count by creation date, even if currently marked merged. This is not a ledger of merge events during the month.
- Month/day grouping uses local time. Repository totals include PR-only activity too.
- Failed repository reads or PR reads produce a partial result with a warning. Pagination caps do not currently produce a truncation warning.

These rules can differ from GitHub's profile graph, include incomplete results for very large accounts, and depend on the credential's access. Month results are cached in memory for ten minutes; Refresh bypasses that cache. The cache is keyed by month, so refresh or restart after changing accounts.
