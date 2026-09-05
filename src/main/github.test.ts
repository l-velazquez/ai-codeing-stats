import { describe, expect, it } from "vitest";
import { buildMonthSnapshot, githubCliCandidates, isoWithLocalOffset, localDayKey, monthBounds, type FetchedCommit, type FetchedPullRequest } from "./github";

describe("githubCliCandidates", () => {
  it("includes Homebrew locations for packaged macOS apps", () => {
    const candidates = githubCliCandidates("darwin", "/usr/bin:/bin");
    expect(candidates).toContain("gh");
    expect(candidates).toContain("/opt/homebrew/bin/gh");
    expect(candidates).toContain("/usr/local/bin/gh");
  });

  it("deduplicates absolute executables derived from PATH", () => {
    const candidates = githubCliCandidates("darwin", "/opt/homebrew/bin:/opt/homebrew/bin");
    expect(candidates.filter((candidate) => candidate === "/opt/homebrew/bin/gh")).toHaveLength(1);
  });
});

describe("monthBounds", () => {
  it("returns local month boundaries", () => {
    const { start, end } = monthBounds("2026-09");
    expect(new Date(start).getDate()).toBe(1);
    expect(new Date(start).getHours()).toBe(0);
    expect(new Date(end)).toEqual(new Date(2026, 9, 1));
  });

  it("rejects malformed months", () => {
    expect(() => monthBounds("2026-13")).toThrow();
    expect(() => monthBounds("september")).toThrow();
    expect(() => monthBounds("2026-9")).toThrow();
  });

  it("handles year rollover", () => {
    const { start, end } = monthBounds("2026-12");
    expect(new Date(end).getFullYear()).toBe(2027);
    expect(new Date(end).getMonth()).toBe(0);
  });
});

describe("localDayKey", () => {
  it("formats a local calendar date", () => {
    expect(localDayKey(new Date(2026, 8, 3, 23, 59).getTime())).toBe("2026-09-03");
  });
});

describe("isoWithLocalOffset", () => {
  it("encodes the local offset", () => {
    const ms = new Date(2026, 8, 1, 0, 0).getTime();
    const iso = isoWithLocalOffset(ms);
    expect(iso.startsWith("2026-09-01T00:00:00")).toBe(true);
    expect(Date.parse(iso)).toBe(ms);
  });
});

describe("buildMonthSnapshot", () => {
  const commit = (repo: string, message: string, at: number, sha = "abc1234"): FetchedCommit => ({
    repo,
    sha,
    message,
    at,
    url: `https://github.com/${repo}/commit/${sha}`,
  });
  const pullRequest = (repo: string, number: number, at: number, merged = true): FetchedPullRequest => ({
    repo,
    number,
    title: `PR ${number}`,
    at,
    url: `https://github.com/${repo}/pull/${number}`,
    merged,
  });

  it("zero-fills every day of the month in order", () => {
    const snapshot = buildMonthSnapshot("2026-02", "l-velazquez", [], [], 0);
    expect(snapshot.days).toHaveLength(28);
    expect(snapshot.days[0].date).toBe("2026-02-01");
    expect(snapshot.days[27].date).toBe("2026-02-28");
    expect(snapshot.state).toBe("ok");
  });

  it("groups commits by local day and repo, excluding merge commits", () => {
    const day = new Date(2026, 8, 7, 10, 30).getTime();
    const commits = [
      commit("acme/webapp", "Fix checkout race", day),
      commit("acme/webapp", "Add retry queue", day + 3_600_000, "def5678"),
      commit("acme/cli", "Bump deps", day + 7_200_000, "aaa1111"),
      commit("acme/webapp", "Merge pull request #12", day + 10_800_000, "bbb2222"),
    ];
    const snapshot = buildMonthSnapshot("2026-09", "l-velazquez", commits, [], 0);
    const day7 = snapshot.days.find((entry) => entry.date === "2026-09-07");
    expect(day7?.commits).toBe(3);
    expect(day7?.repos).toHaveLength(2);
    const webapp = day7?.repos.find((group) => group.repo === "acme/webapp");
    expect(webapp?.commits).toHaveLength(2);
    expect(webapp?.commits.every((entry) => !entry.message.startsWith("Merge"))).toBe(true);
    expect(snapshot.totals.commits).toBe(3);
  });

  it("buckets pull requests and computes repo totals", () => {
    const morning = new Date(2026, 8, 7, 9).getTime();
    const evening = new Date(2026, 8, 7, 20).getTime();
    const nextDay = new Date(2026, 8, 8, 11).getTime();
    const commits = [commit("acme/webapp", "Fix bug", morning), commit("acme/webapp", "More fixes", nextDay, "ccc3333")];
    const pullRequests = [pullRequest("acme/webapp", 412, evening), pullRequest("acme/cli", 7, nextDay, false)];
    const snapshot = buildMonthSnapshot("2026-09", "l-velazquez", commits, pullRequests, 0);
    expect(snapshot.totals.pullRequests).toBe(2);
    expect(snapshot.totals.activeDays).toBe(2);
    expect(snapshot.totals.repos).toBe(2);
    expect(snapshot.repos[0]).toMatchObject({ repo: "acme/webapp", commits: 2, activeDays: 2 });
    expect(snapshot.repos[0]?.lastAt).toBe(nextDay);
  });

  it("ignores records outside the requested month", () => {
    const before = new Date(2026, 7, 31, 23).getTime();
    const after = new Date(2026, 9, 1, 1).getTime();
    const snapshot = buildMonthSnapshot("2026-09", "l-velazquez", [commit("acme/x", "Old", before), commit("acme/x", "New", after, "ddd4444")], [pullRequest("acme/x", 1, after)], 0);
    expect(snapshot.totals.commits).toBe(0);
    expect(snapshot.totals.pullRequests).toBe(0);
  });
});
