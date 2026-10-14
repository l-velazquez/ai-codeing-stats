import { mkdtempSync, rmSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const home = { path: "" };
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => home.path };
});

const { resetStatsCache, scanStats, statsRevision, refreshStats, refreshSubscriptions } = await import("./scanner");

let projects = "";

beforeEach(async () => {
  home.path = mkdtempSync(join(tmpdir(), "azul-incremental-"));
  projects = join(home.path, ".claude", "projects", "demo");
  await mkdir(projects, { recursive: true });
  resetStatsCache();
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(home.path, { recursive: true, force: true });
  resetStatsCache();
});

/** Distinct ids keep the cross-file dedupe from collapsing these into one. */
function assistant(id: string, output: number, at = "2026-09-05T12:00:00.000Z"): string {
  return JSON.stringify({
    type: "assistant", timestamp: at, sessionId: "session-1", cwd: "/tmp/project", requestId: id,
    message: { id, model: "claude-sonnet-5", usage: { input_tokens: 10, output_tokens: output } },
  });
}

/** scanStats coalesces callers for a moment; each pass here must really re-read. */
async function scan() {
  vi.setSystemTime(Date.now() + 10_000);
  return scanStats("30d");
}

it("loads and refreshes T3 Claude allowance without a terminal capture", async () => {
  const caches = join(home.path, ".t3", "caches");
  await mkdir(caches, { recursive: true });
  const cachePath = join(caches, "claudeAgent.json");
  async function report(usedPercent: number, checkedAt: string) {
    await writeFile(cachePath, JSON.stringify({
      driver: "claudeAgent", instanceId: "claudeAgent",
      usageLimits: { checkedAt, windows: [
        { id: "five_hour", usedPercent, resetsAt: "2026-10-14T19:00:00Z" },
      ] },
    }));
  }
  await report(15, "2026-10-14T14:00:00Z");
  expect((await scanStats("30d")).subscriptions.find((usage) => usage.provider === "claude"))
    .toMatchObject({ state: "live", capture: { kind: "t3-cache" }, windows: [{ usedPercent: 15 }] });
  const revision = statsRevision();
  await report(25, "2026-10-14T14:05:00Z");
  await refreshStats();
  expect(statsRevision()).toBeGreaterThan(revision);
  expect((await scanStats("30d")).subscriptions.find((usage) => usage.provider === "claude")?.windows[0].usedPercent).toBe(25);
  await report(30, "2026-10-14T14:10:00Z");
  expect((await refreshSubscriptions()).find((usage) => usage.provider === "claude")?.windows[0].usedPercent).toBe(30);
});

it("picks up appended usage without re-reading what it already parsed", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 5, 12));
  const transcript = join(projects, "session-1.jsonl");
  await writeFile(transcript, `${assistant("a", 100)}\n`);

  const first = await scan();
  expect(first.summary.totalTokens).toBe(110);
  const afterFirst = statsRevision();

  // Nothing changed on disk, so the pass must not report new usage.
  expect((await scan()).summary.totalTokens).toBe(110);
  expect(statsRevision()).toBe(afterFirst);

  await appendFile(transcript, `${assistant("b", 200)}\n`);
  const third = await scan();
  expect(third.summary.totalTokens).toBe(320);
  expect(statsRevision()).not.toBe(afterFirst);
});

it("counts a line that was still being written exactly once", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 5, 12));
  const transcript = join(projects, "session-1.jsonl");
  const line = assistant("a", 100);
  const split = Math.floor(line.length / 2);

  // A transcript caught mid-write: the final line has no newline yet.
  await writeFile(transcript, line.slice(0, split));
  expect((await scan()).summary.totalTokens).toBe(0);

  await appendFile(transcript, `${line.slice(split)}\n`);
  expect((await scan()).summary.totalTokens).toBe(110);
  // A resumed read must not replay the line it deferred.
  expect((await scan()).summary.totalTokens).toBe(110);
});

it("re-reads a transcript that was rewritten rather than appended to", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 5, 12));
  const transcript = join(projects, "session-1.jsonl");
  await writeFile(transcript, `${assistant("a", 100)}\n${assistant("b", 200)}\n`);
  expect((await scan()).summary.totalTokens).toBe(320);

  await writeFile(transcript, `${assistant("c", 5)}\n`);
  expect((await scan()).summary.totalTokens).toBe(15);
});

it("drops usage from a transcript that has been deleted", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 5, 12));
  const transcript = join(projects, "session-1.jsonl");
  await writeFile(transcript, `${assistant("a", 100)}\n`);
  expect((await scan()).summary.totalTokens).toBe(110);

  rmSync(transcript);
  const after = await scan();
  expect(after.summary.totalTokens).toBe(0);
  expect(after.sources.find((source) => source.provider === "claude")?.files).toBe(0);
});
