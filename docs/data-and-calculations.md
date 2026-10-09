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

The source of truth is [`src/shared/pricing.ts`](../src/shared/pricing.ts). Rates are USD per million tokens and are bundled with the app, not downloaded at runtime. Its verification comment records existing rates as of 2026-09-05, Claude Fable rates as of 2026-09-14, GPT-6 Sol and Luna rates as of 2026-09-23, Claude Opus 5.5 rates as of 2026-09-24, GPT-6.1 Sol plus the short-context GPT-5 family (GPT-5, 5-mini, 5-nano, 5.1, 5.2, 5.4-mini, 5.4-nano) as of 2026-10-05, and Claude Sonnet 5.5 as of 2026-10-09. On 2026-10-09 every Claude rate was re-verified and Claude Sonnet 5, Opus 4.5, Sonnet 4.5, Haiku 4.5, and Haiku 5.5 were added. See [OpenAI's model pricing](https://developers.openai.com/api/docs/pricing) for GPT models, [Anthropic's pricing table](https://platform.claude.com/docs/en/about-claude/pricing) for the other Claude models, and [Anthropic's Opus 5.5 model page](https://platform.claude.com/docs/en/models/opus-5-5/overview) for Opus 5.5.

A finite nonnegative provider-reported cost takes precedence over the rate table, including zero. This applies to OpenCode costs and Claude `costUSD`. Such records count as priced and contribute zero calculated cache savings.

Otherwise, each token bucket is multiplied by its model rate and divided by one million. Lookup trims whitespace, lowercases the model, and strips a provider prefix before the last slash. It requires an exact remaining model key; dated variants do not automatically inherit a price.

Unknown models contribute tokens and sessions but zero estimated cost, with partial-pricing warnings. `pricedPercent` measures priced **records**, not the share of tokens or dollars covered.

Each model can carry its own long-context tier. When a record's input (uncached, cache reads, and cache writes together) is above the tier's threshold, the higher rates apply to the entire record. GPT models with a tier use 272,000 input tokens, 2× input/cache rates, and 1.5× output. OpenAI documents this tier for GPT-6 Astra, Sol, and Luna; the implementation assumes it for some older GPT models. Claude Haiku 5.5 uses 100,000 input tokens and 5× on every rate. Other Claude models bill their full 1M context at standard rates.

Cache savings compares cache-read/write cost with charging those same tokens at the uncached input rate. Negative savings are clamped to zero per record, so this is not a complete measure of net cache economics across requests.

## Aggregation and dates

Usage ranges filter record timestamps from `now − N × 24 hours` through now. All includes available history. Daily buckets use the Mac's local calendar date and include zero-activity days. A rolling seven-day period can touch eight calendar dates.

Sessions group by provider and session ID, falling back to timestamp if the ID is absent. Models group by provider/model; projects group by exact workspace path. Session counts across daily or model rows are not additive: the same session can appear in multiple buckets.

Average session cost divides selected-range cost by selected-range session count. Active days counts days containing records. Session start/end are the earliest/latest included usage events, not a timer measuring hands-on work.

Monthly pace uses cost in the trailing 30-day window, divided by elapsed days since the first record within that window (clamped to 1–30 days), multiplied by 30. It is independent of the range selector and can fluctuate with sparse history. It is a projection, not a billing forecast.

## Subscription allowance

Codex uses the newest local rate-limit event. Claude reads captured five-hour and seven-day windows, using the capture file's modification time as report time. No token-to-quota conversion is attempted. A report stays visible after it becomes old; once its known reset timestamp passes, the UI resets that window to 0% used locally without waiting for another provider event. Refresh can read a newer report but cannot create one without agent activity.

## GitHub contributions

The implementation in [`github.ts`](../src/main/github.ts) reads the authenticated user, accessible repositories, authored commits, and authored pull requests from `api.github.com`. It does not scan local Git history; the only local Git read is each workspace's `origin` URL, used to match projects (below).

- Repository discovery considers up to 500 accessible owner/collaborator/organization repositories, sorted by last push, and filters out those not pushed since the selected month began.
- Commit requests filter by authenticated author and month. They do not specify a branch, so this is not an all-branch history scan.
- Each paginated read is capped at 10 pages of 100 items. Repository reads run with concurrency six.
- Commit subjects beginning with common `Merge pull request`, `Merge branch`, `Merge remote-tracking branch`, or `Merge tag` patterns are excluded.
- Pull requests count by creation date, even if currently marked merged. This is not a ledger of merge events during the month.
- Month/day grouping uses local time. Repository totals include PR-only activity too.
- Failed repository reads or PR reads produce a partial result with a warning. Pagination caps do not currently produce a truncation warning.

These rules can differ from GitHub's profile graph, include incomplete results for very large accounts, and depend on the credential's access. Month results are cached in memory for ten minutes; Refresh bypasses that cache. The cache is keyed by month, so refresh or restart after changing accounts.

### Contributions insights

- **Streak** counts consecutive active days inside the month on screen. An empty today does not end the current streak, because the day is not over; days after today are ignored.
- **AI cost per commit** divides AI spend by commits over days that had both. Days with spend and no commits are reported separately as **spend-only days** rather than averaged in.
- **When you ship** buckets commit author times by local weekday and hour.
- The month ribbon draws commits and AI spend on the same day axis but each on its own scale, labelled with its peak. They are not comparable in height.

### Projects matched to repositories

The Projects page matches each AI workspace to a GitHub repository. It first runs `git -C <workspace> remote get-url origin` locally and accepts a GitHub `owner/name` from it. Without a GitHub origin it compares the workspace folder name with active repository names, ignoring case and punctuation, and accepts only a single unambiguous match. Commits are counted over the selected range (All time is capped at six months) and divided into that project's AI cost for **per commit**. Workspaces with no match show **No repo matched**.
