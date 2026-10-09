import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { addTokens, EMPTY_TOKENS, totalTokens } from "../shared/tokenMath";
import { priceTokens, providerLabel } from "../shared/pricing";
import { monthlyPace, paceWindowStart } from "../shared/projection";
import type {
  DailyPoint,
  ModelStat,
  ProjectStat,
  Provider,
  ProviderStat,
  RangeKey,
  SessionStat,
  SourceStatus,
  StatsSnapshot,
  SubscriptionUsage,
  SubscriptionWindow,
  TokenTotals,
  UsageRecord,
} from "../shared/types";
import { readClaudeStatusLineSubscription } from "./claudeStatusLine";
import { createCodexState, parseClaudeLine, parseCodexLine, type CodexState } from "./transcripts";

const execFileAsync = promisify(execFile);
const DAY = 86_400_000;

interface ScanResult {
  records: UsageRecord[];
  source: SourceStatus;
  subscription?: SubscriptionUsage;
}

interface CodexRateLimitWindow {
  used_percent?: unknown;
  window_minutes?: unknown;
  resets_at?: unknown;
}

function codexWindow(value: CodexRateLimitWindow | null | undefined): SubscriptionWindow | null {
  if (value === null || value === undefined) return null;
  const usedPercent = Number(value.used_percent);
  const windowMinutes = Number(value.window_minutes);
  const resetsAt = Number(value.resets_at) * 1_000;
  if (![usedPercent, windowMinutes, resetsAt].every(Number.isFinite) || resetsAt <= 0) return null;
  return {
    label: windowMinutes >= 10_080 ? "Weekly limit" : windowMinutes >= 1_440 ? "Daily limit" : "Session limit",
    usedPercent: Math.min(100, Math.max(0, usedPercent)),
    windowMinutes,
    resetsAt,
  };
}

export function parseCodexSubscription(line: string): SubscriptionUsage | null {
  try {
    const parsed = JSON.parse(line) as {
      timestamp?: unknown;
      payload?: {
        rate_limits?: {
          plan_type?: unknown;
          primary?: CodexRateLimitWindow | null;
          secondary?: CodexRateLimitWindow | null;
        };
      };
    };
    const limits = parsed.payload?.rate_limits;
    if (limits === undefined) return null;
    const windows = [codexWindow(limits.primary), codexWindow(limits.secondary)].filter(
      (window): window is SubscriptionWindow => window !== null,
    );
    const updatedAt = Date.parse(String(parsed.timestamp ?? ""));
    if (windows.length === 0 || !Number.isFinite(updatedAt)) return null;
    return {
      provider: "codex",
      state: "live",
      plan: typeof limits.plan_type === "string" ? limits.plan_type : null,
      updatedAt,
      windows,
      detail: "Read from the latest local Codex rate-limit event.",
    };
  } catch {
    return null;
  }
}

function rangeStart(range: RangeKey, now: number): number | null {
  if (range === "all") return null;
  const days = Number.parseInt(range, 10);
  return now - days * DAY;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root: string, extension: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const child = join(directory, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (entry.name.endsWith(extension)) files.push(child);
    }
  };
  await walk(root);
  // Readdir order is not stable across machines, and cross-file dedupe keeps the
  // first record it sees, so sorting keeps a scan reproducible.
  return files.sort();
}

const NEWLINE = 0x0a;
const RETURN = 0x0d;

/**
 * Streams complete lines starting at a byte offset and returns the offset just
 * past the last newline. Stopping on a line boundary is what makes resuming
 * safe: a transcript caught mid-write leaves its half-written final line for the
 * next pass instead of feeding a truncated line to the parser and losing it.
 */
async function readLinesFrom(
  path: string,
  start: number,
  onLine: (line: string) => void,
): Promise<number> {
  let read = 0;
  let carry: Buffer | null = null;
  const stream = createReadStream(path, { start });
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    read += chunk.length;
    const buffer: Buffer = carry === null ? chunk : Buffer.concat([carry, chunk]);
    let offset = 0;
    for (let index = buffer.indexOf(NEWLINE, offset); index !== -1; index = buffer.indexOf(NEWLINE, offset)) {
      const end = index > offset && buffer[index - 1] === RETURN ? index - 1 : index;
      onLine(buffer.toString("utf8", offset, end));
      offset = index + 1;
    }
    // Hold the trailing partial line -- it may also hold half a multi-byte character.
    carry = offset < buffer.length ? buffer.subarray(offset) : null;
  }
  return start + read - (carry?.length ?? 0);
}

interface TranscriptFile<C> {
  /** Byte offset of the end of the last complete line read from this file. */
  readonly offset: number;
  readonly size: number;
  readonly mtimeMs: number;
  readonly records: UsageRecord[];
  readonly context: C;
}

/**
 * Re-reads only what changed since the last pass.
 *
 * Transcripts are append-only, so a file whose size and mtime still match is
 * reused verbatim and a file that only grew is read from its previous line
 * boundary. A full parse of a mature transcript directory costs seconds and used
 * to run on every tick; an unchanged pass now costs one stat() per file, which is
 * what lets the live refresh run on a short interval.
 *
 * `context` carries whatever a provider must remember between lines of one file
 * (Codex spreads a session's model and workspace across earlier lines), so a
 * resumed read picks up exactly where the previous one stopped.
 */
async function readChangedFiles<C>(
  root: string,
  cache: Map<string, TranscriptFile<C>>,
  fresh: () => C,
  resume: (context: C) => C,
  parse: (line: string, context: C, emit: (record: UsageRecord) => void) => void,
): Promise<{ files: string[]; changed: boolean }> {
  const files = await listFiles(root, ".jsonl");
  const present = new Set(files);
  let changed = false;

  for (const path of cache.keys()) {
    if (present.has(path)) continue;
    cache.delete(path);
    changed = true;
  }

  for (const path of files) {
    let info;
    try {
      info = await stat(path);
    } catch {
      // Vanished between the walk and the stat; the next pass will settle it.
      if (cache.delete(path)) changed = true;
      continue;
    }
    const cached = cache.get(path);
    if (cached !== undefined && cached.size === info.size && cached.mtimeMs === info.mtimeMs) continue;

    // Only an append can be resumed: a file that shrank was rotated or rewritten.
    const previous = cached !== undefined && info.size >= cached.size ? cached : undefined;
    // The context is cloned so a read that throws part way leaves the cache untouched.
    const context = previous === undefined ? fresh() : resume(previous.context);
    const records: UsageRecord[] = [];
    const emit = (record: UsageRecord) => { records.push(record); };
    let offset: number;
    try {
      offset = await readLinesFrom(path, previous?.offset ?? 0, (line) => parse(line, context, emit));
    } catch {
      // A live rollout can rotate while it is being read; keep the rest of the scan.
      continue;
    }

    const merged = previous === undefined ? records : [...previous.records, ...records];
    if (merged.length !== (cached?.records.length ?? 0)) changed = true;
    cache.set(path, { offset, size: info.size, mtimeMs: info.mtimeMs, records: merged, context });
  }

  return { files, changed };
}

interface CodexContext {
  state: CodexState;
  subscription: SubscriptionUsage | null;
}

/** Later wins, and a reading with no timestamp loses to any that has one. */
function newerSubscription(
  best: SubscriptionUsage | null,
  next: SubscriptionUsage | null,
): SubscriptionUsage | null {
  if (next === null) return best;
  if (best === null) return next;
  return (next.updatedAt ?? 0) > (best.updatedAt ?? -1) ? next : best;
}

function hasSubscriptionReading(usage: SubscriptionUsage | undefined): usage is SubscriptionUsage {
  return usage?.state === "live" && usage.windows.length > 0;
}

/** Keep a known report through a transient empty read; the reset timestamp
 * still lets the UI invalidate or refill the bar without another JSON read. */
function keepLastSubscription(
  previous: SubscriptionUsage | undefined,
  next: SubscriptionUsage,
): SubscriptionUsage {
  return hasSubscriptionReading(next) || !hasSubscriptionReading(previous) ? next : previous;
}

const codexFiles = new Map<string, TranscriptFile<CodexContext>>();
const claudeFiles = new Map<string, TranscriptFile<null>>();

async function scanCodex(root: string): Promise<ScanResult & { changed: boolean }> {
  if (!(await exists(root))) {
    codexFiles.clear();
    return {
      records: [],
      changed: false,
      source: {
        provider: "codex",
        label: "Codex",
        path: root,
        state: "missing",
        files: 0,
        records: 0,
        detail: "No Codex session directory found",
      },
    };
  }

  const { files, changed } = await readChangedFiles<CodexContext>(
    root,
    codexFiles,
    () => ({ state: createCodexState(), subscription: null }),
    (context) => ({ state: { ...context.state }, subscription: context.subscription }),
    (line, context, emit) => {
      if (
        !line.includes('"token_count"') &&
        !line.includes('"turn_context"') &&
        !line.includes('"session_meta"')
      ) {
        return;
      }
      if (line.includes('"rate_limits"')) {
        context.subscription = newerSubscription(context.subscription, parseCodexSubscription(line));
      }
      const record = parseCodexLine(line, context.state);
      if (record !== null) emit(record);
    },
  );

  const records: UsageRecord[] = [];
  let subscription: SubscriptionUsage | undefined;
  for (const path of files) {
    const entry = codexFiles.get(path);
    if (entry === undefined) continue;
    records.push(...entry.records);
    subscription = newerSubscription(subscription ?? null, entry.context.subscription) ?? undefined;
  }

  return {
    records,
    changed,
    source: {
      provider: "codex",
      label: "Codex",
      path: root,
      state: "connected",
      files: files.length,
      records: records.length,
      detail: `${files.length.toLocaleString()} local transcripts`,
    },
    subscription,
  };
}

async function scanClaude(root: string): Promise<ScanResult & { changed: boolean }> {
  if (!(await exists(root))) {
    claudeFiles.clear();
    return {
      records: [],
      changed: false,
      source: {
        provider: "claude",
        label: "Claude Code",
        path: root,
        state: "missing",
        files: 0,
        records: 0,
        detail: "No Claude Code project directory found",
      },
    };
  }

  const { files, changed } = await readChangedFiles<null>(
    root,
    claudeFiles,
    () => null,
    () => null,
    (line, _context, emit) => {
      if (!line.includes('"usage"')) return;
      const record = parseClaudeLine(line);
      if (record !== null) emit(record);
    },
  );

  // Claude repeats a message across resumed transcripts, so dedupe spans files and
  // has to run over the merged result rather than inside a single file's parse.
  const records: UsageRecord[] = [];
  const seen = new Set<string>();
  for (const path of files) {
    const entry = claudeFiles.get(path);
    if (entry === undefined) continue;
    for (const record of entry.records) {
      if (record.dedupeKey !== null) {
        if (seen.has(record.dedupeKey)) continue;
        seen.add(record.dedupeKey);
      }
      records.push(record);
    }
  }

  return {
    records,
    changed,
    source: {
      provider: "claude",
      label: "Claude Code",
      path: root,
      state: "connected",
      files: files.length,
      records: records.length,
      detail: `${files.length.toLocaleString()} local transcripts`,
    },
  };
}
interface OpenCodeRow {
  id: string;
  directory: string;
  model: string;
  agent: string | null;
  cost: number;
  tokens_input: number;
  tokens_output: number;
  tokens_reasoning: number;
  tokens_cache_read: number;
  tokens_cache_write: number;
  time_created: number;
  time_updated: number;
}

function openCodeModel(value: string): string {
  try {
    const parsed = JSON.parse(value) as { id?: unknown };
    if (typeof parsed.id === "string") return parsed.id;
  } catch {
    // Older OpenCode versions store the model as plain text.
  }
  return value || "Unknown OpenCode model";
}

let openCodeSignature: string | null = null;

/** The session table is small and indexed, so it is re-queried in full every pass. */
async function scanOpenCode(database: string): Promise<ScanResult & { changed: boolean }> {
  if (!(await exists(database))) {
    const changed = openCodeSignature !== null;
    openCodeSignature = null;
    return {
      records: [],
      changed,
      source: {
        provider: "opencode",
        label: "OpenCode",
        path: database,
        state: "missing",
        files: 0,
        records: 0,
        detail: "No OpenCode database found",
      },
    };
  }

  try {
    const query = `SELECT id, directory, model, agent, cost, tokens_input, tokens_output,
      tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated
      FROM session WHERE tokens_input > 0 OR tokens_output > 0 OR cost > 0;`;
    const { stdout } = await execFileAsync("sqlite3", ["-json", database, query], {
      maxBuffer: 20 * 1024 * 1024,
    });
    const rows = (stdout.trim() ? JSON.parse(stdout) : []) as OpenCodeRow[];
    const records = rows.map<UsageRecord>((row) => ({
      provider: "opencode",
      timestamp: Number(row.time_updated || row.time_created),
      model: openCodeModel(row.model),
      sessionId: row.id,
      workspace: row.directory,
      tokens: {
        uncachedInput: Math.max(
          0,
          Number(row.tokens_input || 0) -
            Number(row.tokens_cache_read || 0) -
            Number(row.tokens_cache_write || 0),
        ),
        cachedInput: Number(row.tokens_cache_read || 0),
        cacheWrite5m: Number(row.tokens_cache_write || 0),
        cacheWrite1h: 0,
        output: Number(row.tokens_output || 0),
        reasoning: Number(row.tokens_reasoning || 0),
      },
      reportedCost: Number.isFinite(Number(row.cost)) ? Number(row.cost) : null,
      dedupeKey: `opencode:${row.id}`,
    }));
    const signature = `${records.length}:${records.reduce((total, record) => total + record.timestamp, 0)}`;
    const changed = signature !== openCodeSignature;
    openCodeSignature = signature;
    return {
      records,
      changed,
      source: {
        provider: "opencode",
        label: "OpenCode",
        path: database,
        state: "connected",
        files: 1,
        records: records.length,
        detail: `${records.length.toLocaleString()} metered sessions`,
      },
    };
  } catch (error) {
    const changed = openCodeSignature !== null;
    openCodeSignature = null;
    return {
      records: [],
      changed,
      source: {
        provider: "opencode",
        label: "OpenCode",
        path: database,
        state: "error",
        files: 1,
        records: 0,
        detail: error instanceof Error ? error.message : "Could not read the database",
      },
    };
  }
}

function localDay(value: number): string {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function projectName(path: string): string {
  if (!path) return "Unassigned";
  return basename(path) || path;
}

interface MutableSession {
  provider: Provider;
  models: Set<string>;
  path: string;
  startedAt: number;
  endedAt: number;
  tokens: TokenTotals;
  cost: number;
  savings: number;
  records: number;
  pricedRecords: number;
}

interface MutableProject {
  name: string;
  path: string;
  cost: number;
  tokens: number;
  sessions: number;
  providers: Provider[];
  lastActive: number;
  sessionIds: Set<string>;
  providerSet: Set<Provider>;
}

interface MutableProvider {
  provider: Provider;
  cost: number;
  tokens: number;
  sessions: number;
  savings: number;
  sessionIds: Set<string>;
}

function aggregate(
  records: UsageRecord[],
  sources: SourceStatus[],
  subscriptions: SubscriptionUsage[],
  range: RangeKey,
  since: number | null,
  now: number,
): StatsSnapshot {
  const filtered = records
    .filter((record) => (since === null || record.timestamp >= since) && record.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp);
  const sessions = new Map<string, MutableSession>();
  const modelMap = new Map<string, ModelStat>();
  const modelSessions = new Map<string, Set<string>>();
  const dayMap = new Map<string, { cost: number; tokens: number; sessions: Set<string>; byProvider: Record<Provider, number> }>();
  const projectMap = new Map<string, MutableProject>();
  const providerMap = new Map<Provider, MutableProvider>();
  const unpricedModels = new Set<string>();
  let allTokens = EMPTY_TOKENS;
  let totalCost = 0;
  let totalSavings = 0;
  let pricedRecords = 0;

  for (const record of filtered) {
    const sessionKey = `${record.provider}:${record.sessionId || record.timestamp}`;
    const priced = priceTokens(record.model, record.tokens, record.reportedCost, record.timestamp);
    allTokens = addTokens(allTokens, record.tokens);
    totalCost += priced.cost;
    totalSavings += priced.savings;
    if (priced.priced) pricedRecords += 1;
    else unpricedModels.add(record.model);

    let session = sessions.get(sessionKey);
    if (session === undefined) {
      session = {
        provider: record.provider,
        models: new Set(),
        path: record.workspace,
        startedAt: record.timestamp,
        endedAt: record.timestamp,
        tokens: EMPTY_TOKENS,
        cost: 0,
        savings: 0,
        records: 0,
        pricedRecords: 0,
      };
      sessions.set(sessionKey, session);
    }
    session.models.add(record.model);
    if (!session.path && record.workspace) session.path = record.workspace;
    session.startedAt = Math.min(session.startedAt, record.timestamp);
    session.endedAt = Math.max(session.endedAt, record.timestamp);
    session.tokens = addTokens(session.tokens, record.tokens);
    session.cost += priced.cost;
    session.savings += priced.savings;
    session.records += 1;
    if (priced.priced) session.pricedRecords += 1;

    const modelKey = `${record.provider}:${record.model}`;
    const existingModel = modelMap.get(modelKey);
    modelMap.set(modelKey, {
      model: record.model,
      provider: record.provider,
      tokens: addTokens(existingModel?.tokens ?? EMPTY_TOKENS, record.tokens),
      totalTokens: totalTokens(addTokens(existingModel?.tokens ?? EMPTY_TOKENS, record.tokens)),
      cost: (existingModel?.cost ?? 0) + priced.cost,
      savings: (existingModel?.savings ?? 0) + priced.savings,
      sessions: 0,
      records: (existingModel?.records ?? 0) + 1,
      priced: (existingModel?.priced ?? true) && priced.priced,
    });
    const modelSessionSet = modelSessions.get(modelKey) ?? new Set<string>();
    modelSessionSet.add(sessionKey);
    modelSessions.set(modelKey, modelSessionSet);

    const day = localDay(record.timestamp);
    const dayEntry = dayMap.get(day) ?? {
      cost: 0,
      tokens: 0,
      sessions: new Set<string>(),
      byProvider: { codex: 0, claude: 0, opencode: 0 },
    };
    dayEntry.cost += priced.cost;
    dayEntry.tokens += totalTokens(record.tokens);
    dayEntry.sessions.add(sessionKey);
    dayEntry.byProvider[record.provider] += priced.cost;
    dayMap.set(day, dayEntry);

    const path = record.workspace || "";
    const project = projectMap.get(path) ?? {
      name: projectName(path),
      path,
      cost: 0,
      tokens: 0,
      sessions: 0,
      providers: [],
      lastActive: 0,
      sessionIds: new Set<string>(),
      providerSet: new Set<Provider>(),
    };
    project.cost += priced.cost;
    project.tokens += totalTokens(record.tokens);
    project.sessionIds.add(sessionKey);
    project.providerSet.add(record.provider);
    project.lastActive = Math.max(project.lastActive, record.timestamp);
    projectMap.set(path, project);

    const provider = providerMap.get(record.provider) ?? {
      provider: record.provider,
      cost: 0,
      tokens: 0,
      sessions: 0,
      savings: 0,
      sessionIds: new Set<string>(),
    };
    provider.cost += priced.cost;
    provider.tokens += totalTokens(record.tokens);
    provider.savings += priced.savings;
    provider.sessionIds.add(sessionKey);
    providerMap.set(record.provider, provider);
  }

  const first = filtered[0]?.timestamp ?? now;
  const dailyStart = since ?? first;
  const daily: DailyPoint[] = [];
  const cursor = new Date(dailyStart);
  cursor.setHours(0, 0, 0, 0);
  const lastDay = new Date(now);
  lastDay.setHours(0, 0, 0, 0);
  while (cursor <= lastDay) {
    const date = localDay(cursor.getTime());
    const entry = dayMap.get(date);
    daily.push({
      date,
      cost: entry?.cost ?? 0,
      tokens: entry?.tokens ?? 0,
      sessions: entry?.sessions.size ?? 0,
      byProvider: entry?.byProvider ?? { codex: 0, claude: 0, opencode: 0 },
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const sessionStats: SessionStat[] = [...sessions.entries()]
    .map(([id, session]) => {
      const models = [...session.models];
      return {
        id,
        provider: session.provider,
        model: models.length === 1 ? (models[0] ?? "Unknown") : `${models.length} models`,
        models,
        project: projectName(session.path),
        path: session.path,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        cost: session.cost,
        savings: session.savings,
        tokens: session.tokens,
        totalTokens: totalTokens(session.tokens),
        records: session.records,
        priced: session.pricedRecords === session.records,
      };
    })
    .sort((a, b) => b.endedAt - a.endedAt);

  const modelStats = [...modelMap.entries()]
    .map(([key, value]) => ({ ...value, sessions: modelSessions.get(key)?.size ?? 0 }))
    .sort((a, b) => b.cost - a.cost || b.totalTokens - a.totalTokens);
  const projectStats = [...projectMap.values()]
    .map(({ sessionIds, providerSet, ...project }) => ({
      ...project,
      sessions: sessionIds.size,
      providers: [...providerSet],
    }))
    .sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);
  const providerStats = [...providerMap.values()]
    .map(({ sessionIds, ...provider }) => ({ ...provider, sessions: sessionIds.size }))
    .sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);

  const inputTotal =
    allTokens.uncachedInput + allTokens.cachedInput + allTokens.cacheWrite5m + allTokens.cacheWrite1h;
  // Pace is deliberately computed from the unfiltered records over a trailing
  // window, not from the selected range, so switching to 90d or All does not
  // change what "per month" means.
  const paceSince = paceWindowStart(now);
  let paceCost = 0;
  let paceFirst: number | null = null;
  for (const record of records) {
    if (record.timestamp < paceSince) continue;
    if (paceFirst === null || record.timestamp < paceFirst) paceFirst = record.timestamp;
    paceCost += priceTokens(record.model, record.tokens, record.reportedCost, record.timestamp).cost;
  }
  const warnings = unpricedModels.size
    ? [`${unpricedModels.size} model${unpricedModels.size === 1 ? "" : "s"} have no verified local price: ${[...unpricedModels].slice(0, 3).join(", ")}`]
    : [];

  return {
    generatedAt: now,
    range,
    since,
    summary: {
      cost: totalCost,
      tokens: allTokens,
      totalTokens: totalTokens(allTokens),
      sessions: sessionStats.length,
      cacheHitRate: inputTotal === 0 ? 0 : allTokens.cachedInput / inputTotal,
      savings: totalSavings,
      pricedPercent: filtered.length === 0 ? 1 : pricedRecords / filtered.length,
      projectedMonthly: monthlyPace(paceCost, paceFirst, now),
      activeDays: dayMap.size,
    },
    daily,
    models: modelStats,
    providers: providerStats,
    projects: projectStats,
    sessions: sessionStats,
    sources,
    subscriptions,
    warnings,
  };
}

interface RecordCache {
  records: UsageRecord[];
  sources: SourceStatus[];
  subscriptions: SubscriptionUsage[];
  at: number;
}

let cachedRecords: RecordCache | null = null;

/**
 * A scan is now cheap enough to run every few seconds, so the short window here
 * only coalesces callers that arrive together; the main-process service drops
 * the snapshot itself before each of its own passes.
 */
const SNAPSHOT_TTL_MS = 2_000;

let revision = 0;
let subscriptionSignature = "";

/**
 * Bumps whenever a pass finds different usage on disk. Callers compare it across
 * a scan to tell a tick that changed something from the many that did not, which
 * is what keeps a short refresh interval from re-aggregating and re-rendering
 * every window while the machine sits idle.
 */
export function statsRevision(): number {
  return revision;
}

/** New prices change every cost without any file changing, so they count as new usage. */
export function markPricingChanged(): void {
  revision += 1;
}

async function collect(now: number): Promise<RecordCache> {
  const home = homedir();
  const previousSubscriptions = cachedRecords?.subscriptions ?? [];
  const [results, claudeSubscription] = await Promise.all([
    Promise.all([
      scanCodex(join(home, ".codex", "sessions")),
      scanClaude(join(home, ".claude", "projects")),
      scanOpenCode(join(home, ".local", "share", "opencode", "opencode.db")),
    ]),
    readClaudeStatusLineSubscription(join(home, ".claude")),
  ]);
  const codex = results.find((result) => result.source.provider === "codex")?.subscription ?? {
      provider: "codex" as const,
      state: "unavailable" as const,
      plan: null,
      updatedAt: null,
      windows: [],
      detail: "Use Codex once, then refresh to capture its latest allowance.",
    };
  const subscriptions = [codex, claudeSubscription].map((next) => keepLastSubscription(
    previousSubscriptions.find((usage) => usage.provider === next.provider),
    next,
  ));
  const cache: RecordCache = {
    records: results.flatMap((result) => result.records),
    sources: results.map((result) => result.source),
    subscriptions,
    at: now,
  };
  cachedRecords = cache;
  // Allowance moves without any record being written, so it is compared on its
  // own rather than inferred from the transcript pass.
  const signature = JSON.stringify(subscriptions);
  if (results.some((result) => result.changed) || signature !== subscriptionSignature) revision += 1;
  subscriptionSignature = signature;
  return cache;
}

export async function scanStats(range: RangeKey): Promise<StatsSnapshot> {
  const now = Date.now();
  const cache = cachedRecords !== null && now - cachedRecords.at <= SNAPSHOT_TTL_MS
    ? cachedRecords : await collect(now);
  return aggregate(cache.records, cache.sources, cache.subscriptions, range, rangeStart(range, now), now);
}

/**
 * Re-reads every source, ignoring the coalescing window. The background loop uses
 * this instead of `scanStats` because it needs fresh records, not an aggregate:
 * the ranges each window is showing are projected separately from the cache.
 */
export async function refreshStats(): Promise<void> {
  await collect(Date.now());
}

export async function refreshSubscriptions(): Promise<SubscriptionUsage[]> {
  if (cachedRecords === null) return (await scanStats("30d")).subscriptions;
  const [codex, claude] = await Promise.all([
    scanCodex(join(homedir(), ".codex", "sessions")),
    readClaudeStatusLineSubscription(join(homedir(), ".claude")),
  ]);
  if (cachedRecords === null) return (await scanStats("30d")).subscriptions;
  cachedRecords.subscriptions = cachedRecords.subscriptions.map((usage) => {
    const next = usage.provider === "claude" ? claude : codex.subscription ?? usage;
    return keepLastSubscription(usage, next);
  });
  return cachedRecords.subscriptions;
}

/** Test seam: forgets every file, so the next scan re-reads from byte zero. */
export function resetStatsCache(): void {
  cachedRecords = null;
  codexFiles.clear();
  claudeFiles.clear();
  openCodeSignature = null;
  subscriptionSignature = "";
}

/** Projection only: all disk reads are coordinated by the main-process service. */
export function cachedStats(range: RangeKey, today = false): StatsSnapshot {
  if (cachedRecords === null) throw new Error("Usage has not been scanned yet.");
  const now = Date.now();
  if (today) return aggregateToday(cachedRecords.records, cachedRecords.sources, cachedRecords.subscriptions, now);
  return aggregate(cachedRecords.records, cachedRecords.sources, cachedRecords.subscriptions,
    range, rangeStart(range, now), now);
}

export function aggregateToday(records: UsageRecord[], sources: SourceStatus[], subscriptions: SubscriptionUsage[], now: number): StatsSnapshot {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return aggregate(records, sources, subscriptions, "7d", midnight.getTime(), now);
}

export function sourceDisplayName(provider: Provider): string {
  return providerLabel(provider);
}
