import type { RangeKey, StatsSnapshot } from "../shared/types";
import { menuBarSummary, type MenuBarState } from "../shared/menuBar";

export interface StatsSource {
  refresh: () => Promise<unknown>;
  read: (range: RangeKey, today?: boolean) => StatsSnapshot;
}

/** One refresh owner for every window, including when all renderers are closed. */
export class StatsService {
  private state: MenuBarState = { summary: null, refreshing: false, error: null };
  private pending: Promise<MenuBarState> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private generation = 0;
  private listeners = new Set<(state: MenuBarState, updated: boolean) => void>();

  constructor(private readonly source: StatsSource) {}
  getState = (): MenuBarState => this.state;
  subscribe(listener: (state: MenuBarState, updated: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private emit(updated = false): void {
    for (const listener of this.listeners) listener(this.state, updated);
  }
  refresh = (): Promise<MenuBarState> => {
    if (this.pending) return this.pending;
    this.state = { ...this.state, refreshing: true };
    // Defer the read so pending is set before any listener can request a refresh.
    this.pending = Promise.resolve().then(() => this.source.refresh()).then(() => {
      this.state = { summary: menuBarSummary(this.source.read("7d", true)), refreshing: false, error: null };
      this.emit(true);
      return this.state;
    }).catch((error: unknown) => {
      this.state = { ...this.state, refreshing: false, error: error instanceof Error ? error.message : "Usage could not be refreshed." };
      this.emit();
      return this.state;
    }).finally(() => { this.pending = null; });
    this.emit();
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
      await this.refresh();
      if (!this.running || generation !== this.generation) return;
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      this.timer = setTimeout(() => { void tick(); }, Math.min(60_000, Math.max(1, midnight.getTime() - Date.now())));
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
