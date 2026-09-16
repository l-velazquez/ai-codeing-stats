import { watch } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface WatchHandle {
  close: () => void;
}

export type WatchFactory = (path: string, recursive: boolean, listener: () => void) => WatchHandle;

export interface WatchTarget {
  readonly path: string;
  /** Transcripts sit in per-project subdirectories; the small capture files do not. */
  readonly recursive: boolean;
}

/**
 * How long a burst of file events is allowed to accumulate before it is scanned.
 * A finished turn writes several lines in quick succession, and one scan should
 * cover all of them.
 */
export const WATCH_DEBOUNCE_MS = 1_000;

/** Floor between two scans, so a long-running agent cannot drive a scan loop. */
export const WATCH_MIN_GAP_MS = 2_000;

/** Every local source azul-code reads, as the directories that change when it does. */
export function transcriptWatchTargets(home = homedir()): WatchTarget[] {
  return [
    { path: join(home, ".claude", "projects"), recursive: true },
    { path: join(home, ".codex", "sessions"), recursive: true },
    // Claude reports its allowance through the status-line capture, not a transcript.
    { path: join(home, ".claude", "azul-code"), recursive: false },
    // SQLite writes the -wal beside the database, so the directory is the signal.
    { path: join(home, ".local", "share", "opencode"), recursive: false },
  ];
}

const nodeWatch: WatchFactory = (path, recursive, listener) => {
  const watcher = watch(path, { recursive, persistent: false }, () => listener());
  // An unmounted volume or a revoked permission must not take the process down;
  // the service's own poll stays behind this as the fallback.
  watcher.on("error", () => watcher.close());
  return { close: () => watcher.close() };
};

/**
 * Turns file system events into scans.
 *
 * The poll in `StatsService` decides how stale usage may get; this decides how
 * quickly a finished turn shows up, which is a different question. Events are
 * throttled rather than debounced on a resetting timer: a continuously appending
 * transcript would keep resetting such a timer and never scan at all. The first
 * event after a quiet spell schedules a scan, every event until then rides along
 * with it, and anything that arrives while a scan runs earns exactly one more.
 */
export class SourceWatcher {
  private readonly handles: WatchHandle[] = [];
  private readonly debounceMs: number;
  private readonly minGapMs: number;
  private readonly watch: WatchFactory;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private dirty = false;
  private stopped = true;
  private lastRun = 0;

  constructor(
    private readonly targets: WatchTarget[],
    private readonly onChange: () => Promise<unknown> | unknown,
    options: { debounceMs?: number; minGapMs?: number; watch?: WatchFactory } = {},
  ) {
    this.debounceMs = options.debounceMs ?? WATCH_DEBOUNCE_MS;
    this.minGapMs = options.minGapMs ?? WATCH_MIN_GAP_MS;
    this.watch = options.watch ?? nodeWatch;
  }

  /** Returns how many targets are being watched; zero means fall back to polling. */
  start(): number {
    if (!this.stopped) return this.handles.length;
    this.stopped = false;
    for (const target of this.targets) {
      try {
        this.handles.push(this.watch(target.path, target.recursive, () => this.schedule()));
      } catch {
        // A provider that is not installed has no directory to watch.
      }
    }
    return this.handles.length;
  }

  stop(): void {
    this.stopped = true;
    this.dirty = false;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    for (const handle of this.handles) {
      try {
        handle.close();
      } catch {
        // Already closed by its own error handler.
      }
    }
    this.handles.length = 0;
  }

  private schedule(): void {
    if (this.stopped) return;
    if (this.running) {
      this.dirty = true;
      return;
    }
    if (this.timer !== null) return;
    const wait = Math.max(this.debounceMs, this.lastRun + this.minGapMs - Date.now());
    this.timer = setTimeout(() => { void this.run(); }, wait);
  }

  private async run(): Promise<void> {
    this.timer = null;
    if (this.stopped) return;
    this.running = true;
    try {
      await this.onChange();
    } catch {
      // The scan reports its own failures; a watcher must keep watching.
    } finally {
      this.running = false;
      // Measured from completion, so a slow scan cannot be followed immediately.
      this.lastRun = Date.now();
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.schedule();
  }
}
