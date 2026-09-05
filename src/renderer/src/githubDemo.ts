import type { GitHubCommitEntry, GitHubDay, GitHubMonthSnapshot, GitHubRepoMonthActivity } from "../../shared/types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function commit(repo: string, sha: string, message: string, at: Date): GitHubCommitEntry {
  return {
    sha,
    message,
    at: at.getTime(),
    url: `https://github.com/${repo}/commit/${sha}`,
  };
}

export function demoGithub(month: string): GitHubMonthSnapshot {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const days: GitHubDay[] = [];
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const seeds: Record<number, { repo: string; sha: string; message: string; hour: number }[]> = {
    [Math.max(1, now.getDate() - 1)]: [
      { repo: "acme/webapp", sha: "a1f9c2e", message: "Fix checkout race condition on slow networks", hour: 9 },
      { repo: "acme/webapp", sha: "b7d401f", message: "Add retry queue for failed payment intents", hour: 11 },
      { repo: "acme/infra", sha: "c9e8a10", message: "Bump terraform AWS provider to 5.80", hour: 15 },
    ],
    [now.getDate()]: [
      { repo: "acme/webapp", sha: "d4e77b9", message: "Split invoice PDF renderer into worker", hour: 10 },
      { repo: "tokenary", sha: "ef20c55", message: "Persist theme choice across restarts", hour: 14 },
    ],
  };
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day);
    const seed = seeds[day] ?? [];
    const repoGroups = new Map<string, GitHubCommitEntry[]>();
    for (const item of seed) {
      const list = repoGroups.get(item.repo) ?? [];
      list.push(commit(item.repo, item.sha, item.message, new Date(year, monthIndex, day, item.hour, 24)));
      repoGroups.set(item.repo, list);
    }
    days.push({
      date: dayKey(date),
      commits: seed.length,
      repos: [...repoGroups.entries()].map(([repo, commits]) => ({ repo, commits })),
      pullRequests: day === now.getDate()
        ? [{ repo: "acme/webapp", number: 412, title: "Payment retry queue with exponential backoff", at: date.getTime(), url: "https://github.com/acme/webapp/pull/412", merged: true }]
        : [],
    });
  }
  const totals = days.reduce(
    (acc, day) => ({
      commits: acc.commits + day.commits,
      repos: new Set([...acc.repos, ...day.repos.map((group) => group.repo)]),
    }),
    { commits: 0, repos: new Set<string>() },
  );
  const repos: GitHubRepoMonthActivity[] = [...totals.repos].map((repo) => ({
    repo,
    commits: days.reduce((sum, day) => sum + (day.repos.find((group) => group.repo === repo)?.commits.length ?? 0), 0),
    activeDays: days.filter((day) => day.repos.some((group) => group.repo === repo)).length,
    lastAt: now.getTime(),
  })).sort((a, b) => b.commits - a.commits);
  return {
    month,
    login: "demo",
    state: "ok",
    detail: "",
    fetchedAt: Date.now(),
    days,
    repos,
    totals: {
      commits: totals.commits,
      activeDays: days.filter((day) => day.commits > 0 || day.pullRequests.length > 0).length,
      repos: repos.length,
      pullRequests: 1,
    },
  };
}
