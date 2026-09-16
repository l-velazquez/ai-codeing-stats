import { afterEach, expect, it, vi } from "vitest";
import {
  SourceWatcher,
  transcriptWatchTargets,
  WATCH_DEBOUNCE_MS,
  WATCH_MIN_GAP_MS,
  type WatchFactory,
} from "./sourceWatcher";

afterEach(() => vi.useRealTimers());

/** Stands in for fs.watch: records what was watched and fires events on demand. */
function fakeWatch(missing: string[] = []) {
  const listeners = new Map<string, () => void>();
  const closed: string[] = [];
  const factory: WatchFactory = (path, recursive, listener) => {
    if (missing.includes(path)) throw new Error("ENOENT");
    listeners.set(path, listener);
    watched.push({ path, recursive });
    return { close: () => { closed.push(path); listeners.delete(path); } };
  };
  const watched: { path: string; recursive: boolean }[] = [];
  return {
    factory,
    watched,
    closed,
    fire: (path: string) => listeners.get(path)?.(),
    any: () => [...listeners.values()][0]?.(),
  };
}

const TARGETS = [{ path: "/claude", recursive: true }, { path: "/codex", recursive: true }];

it("collapses a burst of writes into a single scan", async () => {
  vi.useFakeTimers();
  const fake = fakeWatch();
  const scan = vi.fn(async () => {});
  const watcher = new SourceWatcher(TARGETS, scan, { watch: fake.factory });
  expect(watcher.start()).toBe(2);

  // One finished turn appends several lines across both providers.
  fake.fire("/claude");
  fake.fire("/claude");
  fake.fire("/codex");
  expect(scan).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);
  expect(scan).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(60_000);
  expect(scan).toHaveBeenCalledTimes(1);
  watcher.stop();
});

it("keeps a continuously written transcript from driving a scan loop", async () => {
  vi.useFakeTimers();
  const fake = fakeWatch();
  const scan = vi.fn(async () => {});
  const watcher = new SourceWatcher(TARGETS, scan, { watch: fake.factory });
  watcher.start();

  // An agent writing without pause: a resetting debounce would never fire at all.
  for (let elapsed = 0; elapsed < 10_000; elapsed += 100) {
    fake.fire("/claude");
    await vi.advanceTimersByTimeAsync(100);
  }
  const scans = scan.mock.calls.length;
  expect(scans).toBeGreaterThan(1);
  expect(scans).toBeLessThanOrEqual(Math.ceil(10_000 / (WATCH_DEBOUNCE_MS + WATCH_MIN_GAP_MS)) + 1);
  watcher.stop();
});

it("rescans once for changes that land while a scan is running", async () => {
  vi.useFakeTimers();
  const fake = fakeWatch();
  let release!: () => void;
  const scan = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
  const watcher = new SourceWatcher(TARGETS, scan, { watch: fake.factory });
  watcher.start();

  fake.fire("/claude");
  await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);
  expect(scan).toHaveBeenCalledTimes(1);

  fake.fire("/claude");
  fake.fire("/claude");
  release();
  await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS + WATCH_MIN_GAP_MS);
  expect(scan).toHaveBeenCalledTimes(2);
  watcher.stop();
});

it("keeps watching after a scan throws", async () => {
  vi.useFakeTimers();
  const fake = fakeWatch();
  const scan = vi.fn(async () => { throw new Error("disk unavailable"); });
  const watcher = new SourceWatcher(TARGETS, scan, { watch: fake.factory });
  watcher.start();

  fake.fire("/claude");
  await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);
  fake.fire("/claude");
  await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS + WATCH_MIN_GAP_MS);
  expect(scan).toHaveBeenCalledTimes(2);
  watcher.stop();
});

it("skips a provider that is not installed and reports what it watches", () => {
  const fake = fakeWatch(["/codex"]);
  const watcher = new SourceWatcher(TARGETS, async () => {}, { watch: fake.factory });
  expect(watcher.start()).toBe(1);
  expect(fake.watched.map((entry) => entry.path)).toEqual(["/claude"]);
  watcher.stop();
});

it("closes every handle and cancels a pending scan on stop", async () => {
  vi.useFakeTimers();
  const fake = fakeWatch();
  const scan = vi.fn(async () => {});
  const watcher = new SourceWatcher(TARGETS, scan, { watch: fake.factory });
  watcher.start();
  fake.fire("/claude");
  watcher.stop();

  expect(fake.closed).toEqual(["/claude", "/codex"]);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(scan).not.toHaveBeenCalled();

  // Restarting re-watches rather than leaving the process deaf.
  expect(watcher.start()).toBe(2);
  fake.fire("/claude");
  await vi.advanceTimersByTimeAsync(WATCH_DEBOUNCE_MS);
  expect(scan).toHaveBeenCalledTimes(1);
  watcher.stop();
});

it("watches each provider's directory, recursing only where transcripts nest", () => {
  const targets = transcriptWatchTargets("/home");
  expect(targets).toEqual([
    { path: "/home/.claude/projects", recursive: true },
    { path: "/home/.codex/sessions", recursive: true },
    { path: "/home/.claude/azul-code", recursive: false },
    { path: "/home/.local/share/opencode", recursive: false },
  ]);
});

it("sees a real append inside a nested project directory", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { appendFile, mkdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const root = mkdtempSync(join(tmpdir(), "azul-watch-"));
  const scanned: number[] = [];
  const watcher = new SourceWatcher(
    [{ path: root, recursive: true }],
    () => { scanned.push(Date.now()); },
    { debounceMs: 50, minGapMs: 50 },
  );
  try {
    expect(watcher.start()).toBe(1);
    // The project directory does not exist yet when the watch is set up.
    const project = join(root, "project", "nested");
    await mkdir(project, { recursive: true });
    await appendFile(join(project, "session.jsonl"), "{}\n");

    const deadline = Date.now() + 5_000;
    while (scanned.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(scanned.length).toBeGreaterThan(0);
  } finally {
    watcher.stop();
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);
