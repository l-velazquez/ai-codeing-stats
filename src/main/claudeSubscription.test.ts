import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseT3ClaudeSubscription, readClaudeSubscription } from "./claudeSubscription";

const checkedAt = "2026-10-14T14:00:00.000Z";
const resetsAt = "2026-10-14T19:00:00.000Z";
function cache(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    driver: "claudeAgent", instanceId: "claudeAgent",
    auth: { email: "private@example.test", type: "private-plan" },
    usageLimits: { checkedAt, windows: [
      { id: "five_hour", usedPercent: 15, resetsAt },
      { id: "seven_day", usedPercent: 52, resetsAt: "2026-10-18T15:00:00.000Z" },
    ] },
    ...overrides,
  });
}

const homes: string[] = [];
afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});
async function homeWithCache(contents = cache()) {
  const home = await mkdtemp(join(tmpdir(), "azul-t3-"));
  homes.push(home);
  await mkdir(join(home, ".t3", "caches"), { recursive: true });
  await writeFile(join(home, ".t3", "caches", "claudeAgent.json"), contents);
  return home;
}

describe("Claude allowance from T3 Code", () => {
  it("reads both windows without retaining account information", () => {
    const usage = parseT3ClaudeSubscription(cache());
    expect(usage).toMatchObject({
      provider: "claude", state: "live", updatedAt: Date.parse(checkedAt),
      windows: [
        { label: "5-hour limit", usedPercent: 15, windowMinutes: 300, resetsAt: Date.parse(resetsAt) },
        { label: "Weekly limit", usedPercent: 52, windowMinutes: 10_080 },
      ],
      capture: { kind: "t3-cache", state: "active" },
    });
    expect(JSON.stringify(usage)).not.toContain("private");
  });

  it.each(["null", "[]", "{", cache({ driver: "codex" }), cache({ instanceId: "work-account" }),
    cache({ usageLimits: { checkedAt: "invalid", windows: [] } }),
    cache({ usageLimits: { checkedAt, windows: [{ id: "five_hour", usedPercent: null, resetsAt }] } }),
    cache({ usageLimits: { checkedAt, windows: [{ id: "five_hour", usedPercent: 10, resetsAt: "invalid" }] } }),
  ])("rejects unusable or unrelated caches (%#)", (contents) => {
    expect(parseT3ClaudeSubscription(contents)).toBeNull();
  });

  it("accepts partial and expired reports, clamps percentages, and ignores other buckets", () => {
    expect(parseT3ClaudeSubscription(cache({ usageLimits: { checkedAt, windows: [
      { id: "five_hour", usedPercent: 120, resetsAt: "2026-10-13T19:00:00Z" },
      { id: "seven_day", usedPercent: "52", resetsAt },
      { id: "extra_usage", usedPercent: 70, resetsAt },
    ] } }))?.windows).toEqual([
      { label: "5-hour limit", usedPercent: 100, windowMinutes: 300, resetsAt: Date.parse("2026-10-13T19:00:00Z") },
    ]);
  });

  it("automatically uses T3 without installing a status line", async () => {
    const home = await homeWithCache();
    expect((await readClaudeSubscription(home)).capture?.kind).toBe("t3-cache");
  });

  it("selects the newer report, using the T3 observation time rather than file mtime", async () => {
    const home = await homeWithCache();
    const captureDir = join(home, ".claude", "azul-code");
    await mkdir(captureDir, { recursive: true });
    await writeFile(join(captureDir, "rate-limits.json"), JSON.stringify({
      five_hour: { used_percentage: 24, resets_at: Date.parse(resetsAt) / 1_000 },
    }));
    const { utimes } = await import("node:fs/promises");
    const capturePath = join(captureDir, "rate-limits.json");
    const later = new Date(Date.parse(checkedAt) + 60_000);
    await utimes(capturePath, later, later);
    expect((await readClaudeSubscription(home)).capture?.kind).toBe("claude-statusline");
    const earlier = new Date(Date.parse(checkedAt) - 60_000);
    await utimes(capturePath, earlier, earlier);
    expect((await readClaudeSubscription(home)).capture?.kind).toBe("t3-cache");
    await writeFile(join(home, ".t3", "caches", "claudeAgent.json"), "{");
    expect((await readClaudeSubscription(home)).capture?.kind).toBe("claude-statusline");
  });

  it("preserves the existing setup state when T3 has no usable cache", async () => {
    const home = await homeWithCache("{}");
    expect(await readClaudeSubscription(home)).toMatchObject({ state: "unavailable", capture: { state: "not-configured" } });
    await rm(join(home, ".t3"), { recursive: true });
    expect((await readClaudeSubscription(home)).state).toBe("unavailable");
  });
});
