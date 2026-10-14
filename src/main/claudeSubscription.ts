import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { SubscriptionUsage, SubscriptionWindow } from "../shared/types";
import { readClaudeStatusLineSubscription } from "./claudeStatusLine";

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

/** T3's default Claude instance only: other instances can belong to other accounts. */
export function parseT3ClaudeSubscription(contents: string): SubscriptionUsage | null {
  try {
    const root = object(JSON.parse(contents));
    if (root === null || (root.driver !== undefined && root.driver !== "claudeAgent") ||
      (root.instanceId !== undefined && root.instanceId !== "claudeAgent")) return null;
    const limits = object(root.usageLimits);
    const updatedAt = typeof limits?.checkedAt === "string" ? Date.parse(limits.checkedAt) : NaN;
    if (!Number.isFinite(updatedAt) || !Array.isArray(limits?.windows)) return null;
    const windows: SubscriptionWindow[] = [];
    for (const value of limits.windows) {
      const window = object(value);
      if (window === null || (window.id !== "five_hour" && window.id !== "seven_day")) continue;
      const usedPercent = window.usedPercent;
      const resetsAt = typeof window.resetsAt === "string" ? Date.parse(window.resetsAt) : NaN;
      if (typeof usedPercent !== "number" || !Number.isFinite(usedPercent) ||
        !Number.isFinite(resetsAt) || resetsAt <= 0) continue;
      if (windows.some((existing) => existing.windowMinutes === (window.id === "five_hour" ? 300 : 10_080))) continue;
      windows.push({
        label: window.id === "five_hour" ? "5-hour limit" : "Weekly limit",
        usedPercent: Math.min(100, Math.max(0, usedPercent)),
        windowMinutes: window.id === "five_hour" ? 300 : 10_080,
        resetsAt,
      });
    }
    if (windows.length === 0) return null;
    return {
      provider: "claude",
      state: "live",
      plan: null,
      updatedAt,
      windows,
      detail: "Read from T3 Code’s local Claude allowance cache.",
      capture: { kind: "t3-cache", state: "active" },
    };
  } catch {
    return null;
  }
}

async function readT3ClaudeSubscription(home: string): Promise<SubscriptionUsage | null> {
  try {
    return parseT3ClaudeSubscription(await readFile(join(home, ".t3", "caches", "claudeAgent.json"), "utf8"));
  } catch {
    // T3 is optional, and its cache may be replaced while we read it.
    return null;
  }
}

export async function readClaudeSubscription(home = homedir()): Promise<SubscriptionUsage> {
  const [statusLine, t3] = await Promise.all([
    readClaudeStatusLineSubscription(join(home, ".claude")),
    readT3ClaudeSubscription(home),
  ]);
  return t3 !== null && (statusLine.state !== "live" || (t3.updatedAt ?? 0) > (statusLine.updatedAt ?? 0))
    ? t3 : statusLine;
}
