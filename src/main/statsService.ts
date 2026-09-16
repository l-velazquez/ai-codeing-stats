import type { RangeKey, StatsSnapshot } from "../shared/types";
import { menuBarSummary, type MenuBarState } from "../shared/menuBar";

export interface StatsSource {
  refresh: () => Promise<unknown>;
  read: (range: RangeKey, today?: boolean) => StatsSnapshot;
  /**
   * A counter that moves only when a refresh found different usage on disk.
   * Omit it and every refresh counts as a change.
   */
  revision?: () => number;
}

/**
 * How often the background loop re-checks local usage. Scanning is incremental --
 * an idle pass is a stat() per transcript, not a re-parse of every byte -- so the
 * interval is short enough that the dashboard and the menu bar track a session as
 * it happens rather than lagging a minute behind it.
 */
export const LIVE_INTERVAL_MS = 5_000;

/**
 * The interval once a file system watcher is running. The watcher reports a
 * finished turn within about a second, so the poll stops being the live path and
 * becomes a safety net: it covers a missed event, a provider installed after
 * launch, and the local midnight rollover.
 */
export const WATCHED_INTERVAL_MS = 15_000;

/** One refresh owner for every window, including when all renderers are closed. */
export class StatsService {
  private state: MenuBarState = { summary: null, refreshing: false, error: null };
  private pending: Promise<MenuBarState> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private generation = 0;
  private intervalMs = LIVE_INTERVAL_MS;
  private listeners = new Set<(state: MenuBarState, updated: boolean) => void>();

  constructor(private readonly source: StatsSource) {}
  /** Survives stop/start, so waking from sleep keeps whatever cadence was chosen. */
  setPollInterval(ms: number): void { this.intervalMs = ms; }
  getState = (): MenuBarState => this.state;
  subscribe(listener: (state: MenuBarState, updated: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private emit(updated = false): void {
    for (const listener of this.listeners) listener(this.state, updated);
  }
  /**
   * `silent` is for the background loop: it still publishes the new state, so the
   * menu bar keeps showing a live scan time, but it never raises the spinner --
   * at this interval a visible "Refreshing…" would blink continuously -- and it
   * reports `updated` only when the data really moved, so an idle tick costs the
   * renderers nothing.
   */
  refresh = (options?: { silent?: boolean }): Promise<MenuBarState> => {
    const silent = options?.silent === true;
    if (this.pending) {
      if (!silent && !this.state.refreshing) {
        this.state = { ...this.state, refreshing: true };
        this.emit();
      }
      return this.pending;
    }
    const before = this.source.revision?.() ?? null;
    if (!silent) this.state = { ...this.state, refreshing: true };
    // Defer the read so pending is set before any listener can request a refresh.
    this.pending = Promise.resolve().then(() => this.source.refresh()).then(() => {
      const updated = before === null || (this.source.revision?.() ?? before) !== before;
      this.state = { summary: menuBarSummary(this.source.read("7d", true)), refreshing: false, error: null };
      this.emit(updated);
      return this.state;
    }).catch((error: unknown) => {
      this.state = { ...this.state, refreshing: false, error: error instanceof Error ? error.message : "Usage could not be refreshed." };
      this.emit();
      return this.state;
    }).finally(() => { this.pending = null; });
    if (!silent) this.emit();
    return this.pending;
  };
  async read(range: RangeKey, refresh = false): Promise<StatsSnapshot> {
    if (refresh || !this.state.summary) await this.refresh();
    else if (this.pending) await this.pending;
    if (this.state.error) throw new Error(this.state.error);
    return this.source.read(range);
  }
  start(): void {
    if (this.running) return;
    this.running = true;
    const generation = ++this.generation;
    const tick = async () => {
      await this.refresh({ silent: true });
      if (!this.running || generation !== this.generation) return;
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      this.timer = setTimeout(() => { void tick(); }, Math.min(this.intervalMs, Math.max(1, midnight.getTime() - Date.now())));
    };
    void tick();
  }
  stop(): void {
    this.running = false;
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
