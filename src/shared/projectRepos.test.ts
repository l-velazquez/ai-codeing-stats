import { describe, expect, it } from "vitest";
import type { GitHubMonthSnapshot } from "./types";
import { matchProjectRepo, normalizeProjectName, parseGithubRemote, repoActivitySince } from "./projectRepos";

describe("parseGithubRemote", () => {
  it("reads https, ssh and scp-style remotes", () => {
    expect(parseGithubRemote("https://github.com/l-velazquez/ai-codeing-stats.git")).toBe("l-velazquez/ai-codeing-stats");
    expect(parseGithubRemote("git@github.com:acme/webapp.git")).toBe("acme/webapp");
    expect(parseGithubRemote("ssh://git@github.com/acme/infra")).toBe("acme/infra");
    expect(parseGithubRemote("https://github.com/acme/webapp/\n")).toBe("acme/webapp");
  });

  it("ignores other hosts", () => {
    expect(parseGithubRemote("git@gitlab.com:acme/webapp.git")).toBeNull();
  });
});

describe("matchProjectRepo", () => {
  const repos = ["acme/webapp", "acme/infra", "me/webapp-old", "me/ai-codeing-stats"];

  it("prefers the workspace's git remote over its folder name", () => {
    expect(matchProjectRepo({ name: "AI-Coding Stats", path: "/Users/me/GitHub/AI-Coding Stats" }, "me/ai-codeing-stats", repos))
      .toEqual({ repo: "me/ai-codeing-stats", via: "remote" });
  });

  it("keeps a remote match even when the repo had no activity", () => {
    expect(matchProjectRepo({ name: "x", path: "/x" }, "acme/quiet", repos)).toEqual({ repo: "acme/quiet", via: "remote" });
  });

  it("falls back to a normalized folder name", () => {
    expect(matchProjectRepo({ name: "Infra", path: "/Users/me/src/Infra" }, null, repos)).toEqual({ repo: "acme/infra", via: "folder" });
  });

  it("refuses an ambiguous folder match", () => {
    expect(matchProjectRepo({ name: "webapp", path: "/a/webapp" }, null, [...repos, "other/webapp"])).toBeNull();
  });

  it("normalizes punctuation and case", () => {
    expect(normalizeProjectName("AI-Coding Stats")).toBe(normalizeProjectName("ai_coding.stats"));
  });
});

describe("repoActivitySince", () => {
  it("counts only work at or after the cutoff", () => {
    const month = {
      days: [
        { date: "2026-09-01", commits: 2, repos: [{ repo: "acme/webapp", commits: [{ sha: "a", message: "", at: 100, url: "" }, { sha: "b", message: "", at: 300, url: "" }] }],
          pullRequests: [{ repo: "acme/webapp", number: 1, title: "", at: 50, url: "", merged: true }, { repo: "acme/infra", number: 2, title: "", at: 400, url: "", merged: false }] },
      ],
    } as unknown as GitHubMonthSnapshot;
    const totals = repoActivitySince([month], 200);
    expect(totals.get("acme/webapp")).toEqual({ commits: 1, pullRequests: 0 });
    expect(totals.get("acme/infra")).toEqual({ commits: 0, pullRequests: 1 });
  });
});
