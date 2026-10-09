import { describe, expect, it } from "vitest";
import { activeDaysInOrder, buildDaySummary, buildInvoiceSummary, buildProjectInvoice, currentMonthKey, dayLabel, filterSnapshotRepos, monthLabel, shiftMonthKey } from "./invoice";
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

describe("activeDaysInOrder", () => {
  const quiet = (date: string): GitHubDay => ({ date, commits: 0, repos: [], pullRequests: [] });
  const month = [sampleDay("2026-09-01"), quiet("2026-09-02"), sampleDay("2026-09-03"), sampleDay("2026-09-04")];

  it("drops days with no commits or pull requests", () => {
    expect(activeDaysInOrder(month, "oldest").map((day) => day.date)).toEqual([
      "2026-09-01",
      "2026-09-03",
      "2026-09-04",
    ]);
  });

  it("reverses the month walk for newest first", () => {
    expect(activeDaysInOrder(month, "newest").map((day) => day.date)).toEqual([
      "2026-09-04",
      "2026-09-03",
      "2026-09-01",
    ]);
  });

  it("leaves the snapshot's own array untouched", () => {
    const days = [...month];
    activeDaysInOrder(days, "newest");
    expect(days.map((day) => day.date)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"]);
  });

  it("handles an empty month", () => {
    expect(activeDaysInOrder([], "newest")).toEqual([]);
  });
});

function mixedDay(date: string): GitHubDay {
  return {
    date,
    commits: 3,
    repos: [
      { repo: "acme/webapp", commits: [{ sha: "a1", message: "Fix checkout race", at: 0, url: "u" }, { sha: "a2", message: "Add retry queue", at: 0, url: "u" }] },
      { repo: "me/dotfiles", commits: [{ sha: "d1", message: "Tweak zsh prompt", at: 0, url: "u" }] },
    ],
    pullRequests: [
      { repo: "acme/webapp", number: 412, title: "Retry queue", at: 0, url: "u", merged: true },
      { repo: "me/dotfiles", number: 3, title: "Prompt", at: 0, url: "u", merged: false },
    ],
  };
}

function mixedSnapshot(): GitHubMonthSnapshot {
  return {
    ...sampleSnapshot([mixedDay("2026-09-02"), { date: "2026-09-03", commits: 1, repos: [{ repo: "me/dotfiles", commits: [{ sha: "d2", message: "Alias git", at: 0, url: "u" }] }], pullRequests: [] }]),
    repos: [
      { repo: "acme/webapp", commits: 2, activeDays: 1, lastAt: 0 },
      { repo: "me/dotfiles", commits: 2, activeDays: 2, lastAt: 0 },
    ],
    totals: { commits: 4, activeDays: 2, repos: 2, pullRequests: 2 },
  };
}

describe("filterSnapshotRepos", () => {
  it("drops excluded projects from days and every total", () => {
    const filtered = filterSnapshotRepos(mixedSnapshot(), (repo) => repo !== "me/dotfiles");
    expect(filtered.totals).toEqual({ commits: 2, activeDays: 1, repos: 1, pullRequests: 1 });
    expect(filtered.days[1]).toMatchObject({ commits: 0, repos: [], pullRequests: [] });
    expect(buildInvoiceSummary(filtered)).not.toContain("dotfiles");
  });
});

describe("buildProjectInvoice", () => {
  it("groups the month by project with a description line", () => {
    const text = buildProjectInvoice(mixedSnapshot());
    expect(text).toContain("acme/webapp\n2 commits across 1 day (Sep 2) · 1 pull request, 1 merged\n  - Sep 2: Fix checkout race");
    expect(text).toContain("me/dotfiles\n2 commits across 2 days (Sep 2 – Sep 3)");
    expect(text).toContain("  - Opened #3: Prompt");
    expect(text.endsWith("Total: 4 commits · 2 pull requests · 2 projects · 2 active days")).toBe(true);
  });

  it("handles a month with nothing selected", () => {
    expect(buildProjectInvoice(filterSnapshotRepos(mixedSnapshot(), () => false))).toContain("No GitHub activity recorded.");
  });
});
