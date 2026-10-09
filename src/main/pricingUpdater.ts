import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MODELS_DEV_URL, parseModelRate, ratesFromModelsDev } from "../shared/modelsDev";
import { recordRates, setRemoteRates, type RateHistory, type RatePeriod } from "../shared/pricing";
import type { PricingStatus } from "../shared/types";

/** Prices move a few times a year; checking a few times a day is plenty. */
export const PRICING_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** After a failed check, try again soon: arriving on a network should not wait hours. */
export const PRICING_RETRY_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 20_000;
// The catalog is about 5 MB today. Anything far larger is not the file we expect.
const MAX_BYTES = 50 * 1024 * 1024;

interface CacheFile {
  readonly version: 1;
  readonly etag: string | null;
  readonly checkedAt: number;
  readonly history: RateHistory;
}

export interface PricingUpdaterOptions {
  /** Where the fetched history is kept between launches. */
  readonly path: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  /** Called after the active prices changed, so totals can be recomputed. */
  readonly onChange: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The cache file is our own output, but it lives on disk where anything can edit
 * it, so every stored rate is checked again; a bad file is ignored as a whole.
 */
function readCache(path: string): CacheFile | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isRecord(raw) || raw.version !== 1 || !isRecord(raw.history) || typeof raw.checkedAt !== "number") return null;
    const history: Record<string, RatePeriod[]> = {};
    for (const [model, periods] of Object.entries(raw.history)) {
      if (!Array.isArray(periods)) return null;
      const valid: RatePeriod[] = [];
      for (const period of periods) {
        if (!isRecord(period) || !(period.since === null || typeof period.since === "number")) return null;
        const rate = parseModelRate(period.rate);
        if (rate === null) return null;
        valid.push({ since: period.since, rate });
      }
      history[model] = valid;
    }
    return { version: 1, etag: typeof raw.etag === "string" ? raw.etag : null, checkedAt: raw.checkedAt, history };
  } catch {
    return null;
  }
}

/**
 * fetch rejects with a TypeError when no request could be made at all (no network,
 * DNS failure, refused connection) and with a TimeoutError when ours expires.
 * Anything else, such as a bad status or an unreadable body, did reach models.dev.
 */
function isConnectionError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function writeCache(path: string, cache: CacheFile): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, JSON.stringify(cache), { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, path);
  } catch {
    // The prices still apply for this run; they are fetched again next launch.
  }
}

/**
 * Keeps model prices current between releases by reading models.dev. Nothing
 * about the user is sent: it is a plain GET of a public file. When the fetch
 * fails, the last good copy stays in use, and without one the bundled table does.
 */
export class PricingUpdater {
  private cache: CacheFile | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Promise<void> | null = null;
  private enabled = false;
  private error: string | null = null;
  private offline = false;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: PricingUpdaterOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
  }

  /** Turns live prices on or off. Off means bundled prices only, and no network. */
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.stopTimer();
      if (this.cache !== null && Object.keys(this.cache.history).length > 0) {
        setRemoteRates({});
        this.options.onChange();
      }
      return;
    }
    this.cache ??= readCache(this.options.path);
    if (this.cache !== null) {
      setRemoteRates(this.cache.history);
      this.options.onChange();
    }
    this.schedule(this.cache === null ? 0 : Math.max(0, this.cache.checkedAt + PRICING_INTERVAL_MS - this.now()));
  }

  stop(): void {
    this.stopTimer();
  }

  status(): PricingStatus {
    const models = this.enabled && this.cache !== null ? Object.keys(this.cache.history).length : 0;
    return {
      source: models > 0 ? "models.dev" : "bundled",
      enabled: this.enabled,
      checkedAt: this.cache?.checkedAt ?? null,
      models,
      error: this.enabled ? this.error : null,
      offline: this.enabled && this.offline,
    };
  }

  /** Fetches now, sharing a fetch already in flight. */
  update(): Promise<void> {
    this.pending ??= this.fetchCatalog().finally(() => { this.pending = null; });
    return this.pending;
  }

  private stopTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule(delay: number): void {
    this.stopTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.update().finally(() => {
        if (this.enabled) this.schedule(this.error === null ? PRICING_INTERVAL_MS : PRICING_RETRY_MS);
      });
    }, delay);
  }

  private async fetchCatalog(): Promise<void> {
    if (!this.enabled) return;
    const now = this.now();
    try {
      const headers: Record<string, string> = { "User-Agent": "azul-code-local" };
      if (this.cache?.etag) headers["If-None-Match"] = this.cache.etag;
      const response = await this.fetch(MODELS_DEV_URL, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!this.enabled) return;
      const history = this.cache?.history ?? {};
      if (response.status === 304 && this.cache !== null) {
        this.cache = { ...this.cache, checkedAt: now };
      } else {
        if (!response.ok) throw new Error(`models.dev returned HTTP ${response.status}.`);
        const length = Number(response.headers.get("content-length"));
        if (Number.isFinite(length) && length > MAX_BYTES) throw new Error("models.dev returned an unexpectedly large file.");
        const text = await response.text();
        if (text.length > MAX_BYTES) throw new Error("models.dev returned an unexpectedly large file.");
        const observed = ratesFromModelsDev(JSON.parse(text));
        if (observed === null) throw new Error("models.dev returned no usable prices.");
        if (!this.enabled) return;
        const next = recordRates(history, observed, now);
        this.cache = { version: 1, etag: response.headers.get("etag"), checkedAt: now, history: next };
        if (JSON.stringify(next) !== JSON.stringify(history)) {
          setRemoteRates(next);
          this.options.onChange();
        }
      }
      this.error = null;
      this.offline = false;
      writeCache(this.options.path, this.cache);
    } catch (error) {
      this.offline = isConnectionError(error);
      this.error = this.offline ? "No internet connection." : error instanceof Error ? error.message : "Prices could not be updated.";
    }
  }
}
