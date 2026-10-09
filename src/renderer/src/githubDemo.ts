import type { GitHubCommitEntry, GitHubDay, GitHubMonthSnapshot, GitHubPullRequestEntry, GitHubRepoMonthActivity } from "../../shared/types";
import { demoState } from "./lib/demoState";

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

interface DemoCommit {
  repo: string;
  sha: string;
  message: string;
  hour: number;
  minute?: number;
}

const DEMO_WORK: Record<string, string[]> = {
  "acme/webapp": [
    "Debounce search input on the orders table",
    "Move invoice totals into a shared selector",
    "Fix timezone drift in the billing calendar",
    "Add empty state for archived customers",
    "Cache exchange rates for the checkout summary",
    "Guard against double-submit on refunds",
  ],
  "acme/infra": [
    "Tighten IAM policy for the export bucket",
    "Add staging alarm for queue depth",
    "Pin node image to 26.8 in CI",
  ],
  "azul-code": [
    "Draw the month ribbon on Contributions",
    "Read Codex usage from rotated logs",
    "Keep the menu bar figure in sync on wake",
    "Tidy settings sheet spacing",
  ],
  "typeset/engine": [
    "Kern pairs for the italic cut",
    "Speed up line breaking on long paragraphs",
  ],
};
const DEMO_REPOS = Object.keys(DEMO_WORK);

/** Small deterministic hash so a given demo day always looks the same. */
function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function synthesiseDay(date: Date): DemoCommit[] {
  const seed = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  if (noise(seed) < (weekend ? 0.7 : 0.18)) return [];
  const count = 1 + Math.floor(noise(seed + 1) * (weekend ? 2 : 6));
  const focus = DEMO_REPOS[Math.floor(noise(seed + 2) * DEMO_REPOS.length)];
  return Array.from({ length: count }, (_, index) => {
    const repo = noise(seed + 10 + index) < 0.7 ? focus : DEMO_REPOS[Math.floor(noise(seed + 20 + index) * DEMO_REPOS.length)];
    const messages = DEMO_WORK[repo];
    const evening = noise(seed + 30 + index) < 0.2;
    return {
      repo,
      sha: Math.floor(noise(seed + 40 + index) * 0xfffffff).toString(16).padStart(7, "0"),
      message: messages[Math.floor(noise(seed + 50 + index) * messages.length)],
      hour: evening ? 20 + Math.floor(noise(seed + 60 + index) * 3) : 9 + Math.floor(noise(seed + 70 + index) * 9),
      minute: Math.floor(noise(seed + 80 + index) * 60),
    };
  }).sort((a, b) => a.hour * 60 + (a.minute ?? 0) - (b.hour * 60 + (b.minute ?? 0)));
}

function synthesisePullRequests(date: Date, commits: readonly DemoCommit[]): GitHubPullRequestEntry[] {
  const seed = date.getFullYear() * 400 + date.getMonth() * 32 + date.getDate();
  if (commits.length < 3 || noise(seed + 90) < 0.45) return [];
  const repo = commits[commits.length - 1].repo;
  const number = 300 + Math.floor(noise(seed + 91) * 200);
  return [{
    repo,
    number,
    title: commits[commits.length - 1].message,
    at: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17).getTime(),
    url: `https://github.com/${repo}/pull/${number}`,
    merged: noise(seed + 92) < 0.75,
  }];
}

export function demoGithub(month: string): GitHubMonthSnapshot {
  const state = demoState();
  if (state === "fresh" || state === "error") {
    return {
      month,
      login: "",
      state: "setup",
      detail: "azul-code could not find an authenticated GitHub CLI on this Mac.",
      fetchedAt: Date.now(),
      days: [],
      repos: [],
      totals: { commits: 0, activeDays: 0, repos: 0, pullRequests: 0 },
      setup: {
        reason: "needs-auth",
        command: "gh auth login",
        helpUrl: "https://cli.github.com/",
      },
    };
  }
  if (state === "empty") {
    return {
      month,
      login: "demo",
      state: "ok",
      detail: "",
      fetchedAt: Date.now(),
      days: [],
      repos: [],
      totals: { commits: 0, activeDays: 0, repos: 0, pullRequests: 0 },
    };
  }
  const now = new Date();
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const isCurrentMonth = year === now.getFullYear() && monthIndex === now.getMonth();
  const days: GitHubDay[] = [];
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  // Yesterday and today stay hand-written so Overview's "Today" card reads the
  // same every time; everything earlier is synthesised from the date so past
  // months have a believable shape instead of an empty calendar.
  const seeds: Record<number, DemoCommit[]> = isCurrentMonth ? {
    [Math.max(1, now.getDate() - 1)]: [
      { repo: "acme/webapp", sha: "a1f9c2e", message: "Fix checkout race condition on slow networks", hour: 9 },
      { repo: "acme/webapp", sha: "b7d401f", message: "Add retry queue for failed payment intents", hour: 11 },
      { repo: "acme/infra", sha: "c9e8a10", message: "Bump terraform AWS provider to 5.80", hour: 15 },
    ],
    [now.getDate()]: [
      { repo: "acme/webapp", sha: "d4e77b9", message: "Split invoice PDF renderer into worker", hour: 10 },
      { repo: "azul-code", sha: "ef20c55", message: "Persist theme choice across restarts", hour: 14 },
    ],
  } : {};
  let pullRequestCount = 0;
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day);
    if (date.getTime() > now.getTime()) {
      days.push({ date: dayKey(date), commits: 0, repos: [], pullRequests: [] });
      continue;
    }
    const seed = seeds[day] ?? synthesiseDay(date);
    const repoGroups = new Map<string, GitHubCommitEntry[]>();
    for (const item of seed) {
      const list = repoGroups.get(item.repo) ?? [];
      list.push(commit(item.repo, item.sha, item.message, new Date(year, monthIndex, day, item.hour, item.minute ?? 24)));
      repoGroups.set(item.repo, list);
    }
    const pullRequests: GitHubPullRequestEntry[] = isCurrentMonth && day === now.getDate()
      ? [{ repo: "acme/webapp", number: 412, title: "Payment retry queue with exponential backoff", at: date.getTime(), url: "https://github.com/acme/webapp/pull/412", merged: true }]
      : synthesisePullRequests(date, seed);
    pullRequestCount += pullRequests.length;
    days.push({
      date: dayKey(date),
      commits: seed.length,
      repos: [...repoGroups.entries()].map(([repo, commits]) => ({ repo, commits })),
      pullRequests,
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
      pullRequests: pullRequestCount,
    },
  };
}
