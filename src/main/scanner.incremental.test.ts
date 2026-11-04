import { mkdtempSync, rmSync } from "node:fs";
import { appendFile, mkdir, rename, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const home = { path: "" };
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => home.path };
});

const { resetStatsCache, scanStats, statsRevision, refreshStats, refreshSubscriptions, cachedStats } = await import("./scanner");

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

it("re-reads same-size edits and reports corrections with unchanged record counts", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 5, 12));
  const transcript = join(projects, "session-1.jsonl");
  await writeFile(transcript, `${assistant("a", 100)}\n`);
  expect((await scan()).summary.totalTokens).toBe(110);
  const revision = statsRevision();

  await writeFile(transcript, `${assistant("a", 900)}\n`);
  // Make the metadata change deterministic even on coarse file systems.
  await utimes(transcript, new Date(), new Date(Date.now() + 5_000));
  expect((await scan()).summary.totalTokens).toBe(910);
  expect(statsRevision()).toBeGreaterThan(revision);

  const afterEdit = statsRevision();
  await writeFile(transcript, `${assistant("a", 5)}\n`);
  expect((await scan()).summary.totalTokens).toBe(15);
  expect(statsRevision()).toBeGreaterThan(afterEdit);
});

it("re-reads a larger file atomically replacing an existing transcript", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 5, 12));
  const transcript = join(projects, "session-1.jsonl");
  await writeFile(transcript, `${assistant("a", 100)}\n`);
  expect((await scan()).summary.totalTokens).toBe(110);
  const replacement = join(projects, "replacement.tmp");
  await writeFile(replacement, `${assistant("b", 200)}\n${assistant("c", 300)}\n`);
  await rename(replacement, transcript);
  expect((await scan()).summary.totalTokens).toBe(520);
});

it.each(["claude", "codex"])("reports removal of the entire %s history directory", async (provider) => {
  const root = join(home.path, `.${provider}`, provider === "claude" ? "projects" : "sessions");
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "empty.jsonl"), "");
  await refreshStats();
  const revision = statsRevision();
  rmSync(root, { recursive: true });
  await refreshStats();
  expect(statsRevision()).toBeGreaterThan(revision);
  expect((await scanStats("all")).sources.find((source) => source.provider === provider)?.state).toBe("missing");
});

it("drops cached usage and changes revision when the provider directory is removed", async () => {
  await writeFile(join(projects, "session-1.jsonl"), `${assistant("a", 100)}\n`);
  expect((await scanStats("all")).summary.totalTokens).toBe(110);
  const revision = statsRevision();
  rmSync(join(home.path, ".claude", "projects"), { recursive: true });
  await refreshStats();
  expect((await scanStats("all")).summary.totalTokens).toBe(0);
  expect(statsRevision()).toBeGreaterThan(revision);
});

it("projects costs from an exact cutoff, including only the in-window turns of a session", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 8, 6, 12));
  const cutoff = Date.parse("2026-09-05T12:00:00Z");
  const line = (id: string, at: number, costUSD: number) => JSON.stringify({
    ...JSON.parse(assistant(id, 100, new Date(at).toISOString())), costUSD,
  });
  await writeFile(join(projects, "session-1.jsonl"), [
    line("old", cutoff - 1, 1000), line("boundary", cutoff, 10), line("new", cutoff + 1, 20),
    line("future", Date.now() + 100_000, 500),
  ].join("\n") + "\n");
  await refreshStats();
  const result = cachedStats("all", false, cutoff);
  expect(result.since).toBe(cutoff);
  expect(result.summary.cost).toBe(30);
  expect(result.projects[0].cost).toBe(30);
  expect(result.sessions).toHaveLength(1);
  expect(result.sessions[0]).toMatchObject({ cost: 30, records: 2, totalTokens: 220 });
  expect(cachedStats("all").projects[0].cost).toBe(1030);
});
