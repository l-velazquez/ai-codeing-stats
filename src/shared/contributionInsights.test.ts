import { describe, expect, it } from "vitest";
import type { GitHubDay, GitHubMonthSnapshot } from "./types";
import { buildContributionInsights, hourLabel, monthStreak } from "./contributionInsights";

function day(date: string, commitHours: number[], merged = 0): GitHubDay {
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  return {
    date,
    commits: commitHours.length,
    repos: commitHours.length > 0
      ? [{
          repo: "acme/webapp",
          commits: commitHours.map((hour, index) => ({
            sha: `${date}-${index}`,
            message: "work",
            at: new Date(year, month - 1, dayOfMonth, hour, 5).getTime(),
            url: "u",
          })),
        }]
      : [],
    pullRequests: Array.from({ length: merged }, (_, index) => ({
      number: index + 1, title: "pr", repo: "acme/webapp", at: 0, url: "u", merged: true,
    })),
  };
}

function snapshot(days: GitHubDay[]): GitHubMonthSnapshot {
  return {
    month: "2026-09", login: "demo", state: "ok", detail: "", fetchedAt: 0, days, repos: [],
    totals: { commits: 0, activeDays: 0, repos: 0, pullRequests: 0 },
  };
}

describe("monthStreak", () => {
  const days = [
    day("2026-09-01", [9]), day("2026-09-02", [9]), day("2026-09-03", [9]),
    day("2026-09-04", []),
    day("2026-09-05", [9]), day("2026-09-06", [9]),
    day("2026-09-07", []), day("2026-09-08", [9]),
  ];

  it("finds the longest run and the run ending today", () => {
    expect(monthStreak(days.slice(0, 6), "2026-09-06")).toEqual({ current: 2, longest: 3 });
  });

  it("does not break the current streak on a still-empty today", () => {
    expect(monthStreak(days.slice(0, 7), "2026-09-07")).toEqual({ current: 2, longest: 3 });
  });

  it("ignores days that have not happened yet", () => {
    expect(monthStreak(days, "2026-09-03")).toEqual({ current: 3, longest: 3 });
  });

  it("reports zero once a full past day was empty", () => {
    expect(monthStreak(days.slice(0, 4), "2026-09-04").current).toBe(3);
    expect(monthStreak([...days.slice(0, 4), day("2026-09-05", [])], "2026-09-05").current).toBe(0);
  });
});

describe("buildContributionInsights", () => {
  const days = [day("2026-09-01", [9, 9, 14], 1), day("2026-09-02", []), day("2026-09-03", [22])];
  const spend = new Map([
    ["2026-09-01", { sessions: 3, cost: 6 }],
    ["2026-09-02", { sessions: 2, cost: 4 }],
    ["2026-09-03", { sessions: 1, cost: 2 }],
  ]);
  const insights = buildContributionInsights(snapshot(days), spend, "2026-09-03");

  it("prices commits only on days that had both spend and commits", () => {
    expect(insights.aiCost).toBe(12);
    expect(insights.costPerCommit).toBe(2);
    expect(insights.spendOnlyDays).toBe(1);
  });

  it("buckets commits by local weekday and hour", () => {
    expect(insights.peakHour).toBe(9);
    expect(insights.busiestWeekday).toBe(new Date(2026, 8, 1).getDay());
    expect(insights.punchPeak).toBe(2);
  });

  it("aligns each repo strip to the month's days", () => {
    expect(insights.repoStrips.get("acme/webapp")).toEqual([3, 0, 1]);
    expect(insights.mergedPullRequests).toBe(1);
  });

  it("has no cost per commit without paired days", () => {
    expect(buildContributionInsights(snapshot(days), new Map(), "2026-09-03").costPerCommit).toBeNull();
  });
});

describe("hourLabel", () => {
  it("formats compact 12-hour labels", () => {
    expect([0, 9, 12, 18].map(hourLabel)).toEqual(["12a", "9a", "12p", "6p"]);
  });
});
