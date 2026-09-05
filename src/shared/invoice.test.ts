import { describe, expect, it } from "vitest";
import { buildDaySummary, buildInvoiceSummary, currentMonthKey, dayLabel, monthLabel, shiftMonthKey } from "./invoice";
import type { GitHubDay, GitHubMonthSnapshot } from "./types";

function sampleDay(date: string): GitHubDay {
  return {
    date,
    commits: 2,
    repos: [
      {
        repo: "acme/webapp",
        commits: [
          { sha: "a1f9c2e", message: "Fix checkout race", at: 0, url: "u1" },
          { sha: "b7d401f", message: "Add retry queue", at: 0, url: "u2" },
        ],
      },
    ],
    pullRequests: [{ repo: "acme/webapp", number: 412, title: "Retry queue", at: 0, url: "u3", merged: true }],
  };
}

function sampleSnapshot(days: GitHubDay[]): GitHubMonthSnapshot {
  return {
    month: "2026-09",
    login: "l-velazquez",
    state: "ok",
    detail: "",
    fetchedAt: 0,
    days,
    repos: [{ repo: "acme/webapp", commits: 2, activeDays: 1, lastAt: 0 }],
    totals: { commits: 2, activeDays: 1, repos: 1, pullRequests: 1 },
  };
}

describe("labels", () => {
  it("formats month and day labels", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(dayLabel("2026-09-07")).toBe("Monday, Sep 7");
  });
});

describe("month keys", () => {
  it("computes the current month and shifts across year boundaries", () => {
    expect(currentMonthKey(new Date(2026, 8, 2))).toBe("2026-09");
    expect(shiftMonthKey("2026-09", -1)).toBe("2026-08");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
  });
});

describe("buildDaySummary", () => {
  it("renders commits per repo and pull requests", () => {
    const text = buildDaySummary(sampleDay("2026-09-07"));
    expect(text).toContain("Monday, Sep 7 — 2 commits");
    expect(text).toContain("acme/webapp (2 commits):");
    expect(text).toContain("  - Fix checkout race");
    expect(text).toContain("  - merged Retry queue (acme/webapp #412)");
  });
});

describe("buildInvoiceSummary", () => {
  it("joins active days with a header and totals footer", () => {
    const active = sampleDay("2026-09-07");
    const inactive: GitHubDay = { date: "2026-09-08", commits: 0, repos: [], pullRequests: [] };
    const snapshot = sampleSnapshot([active, inactive]);
    const text = buildInvoiceSummary(snapshot);
    expect(text.startsWith("September 2026 — GitHub contributions (@l-velazquez)")).toBe(true);
    expect(text).toContain("Monday, Sep 7");
    expect(text).not.toContain("Tuesday, Sep 8");
    expect(text.endsWith("Total: 2 commits · 1 pull request · 1 project · 1 active day")).toBe(true);
  });

  it("handles an empty month", () => {
    const text = buildInvoiceSummary(sampleSnapshot([]));
    expect(text).toContain("No GitHub activity recorded.");
  });
});
