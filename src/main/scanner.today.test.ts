import { expect, it } from "vitest";
import { aggregateToday } from "./scanner";
import { EMPTY_TOKENS } from "../shared/tokenMath";
import type { UsageRecord } from "../shared/types";

it("counts only today's events in a session crossing local midnight and excludes future timestamps", () => {
  const now = new Date(2026, 8, 5, 12).getTime();
  const midnight = new Date(2026, 8, 5).getTime();
  const record = (timestamp: number, reportedCost: number): UsageRecord => ({
    provider: "opencode", timestamp, reportedCost, model: "custom-model", sessionId: "crosses-midnight",
    workspace: "/project", dedupeKey: null, tokens: { ...EMPTY_TOKENS, uncachedInput: 100 },
  });
  const result = aggregateToday([record(midnight - 1, 50), record(midnight, 2), record(now, 3), record(now + 1, 99)], [], [], now);
  expect(result.summary).toMatchObject({ cost: 5, totalTokens: 200, sessions: 1, pricedPercent: 1 });
  expect(result.providers[0].cost).toBe(5);
  expect(result.daily).toHaveLength(1);
  expect(result.daily[0].date).toBe("2026-09-05");
});

it("keeps unknown models visible with partial pricing instead of guessing a cost", () => {
  const now = Date.now();
  const result = aggregateToday([{
    provider: "codex", timestamp: now, reportedCost: null, model: "unknown-model", sessionId: "one",
    workspace: "", dedupeKey: null, tokens: { ...EMPTY_TOKENS, output: 250 },
  }], [], [], now);
  expect(result.summary).toMatchObject({ cost: 0, totalTokens: 250, pricedPercent: 0 });
});
