import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { GitHubCommitEntry, GitHubDay, GitHubMonthSnapshot, GitHubRepoMonthActivity } from "../shared/types";

const execFileAsync = promisify(execFile);

const API_ROOT = "https://api.github.com";
const MAX_REPOS = 500;
const REPO_CONCURRENCY = 6;
const CACHE_TTL = 10 * 60_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export interface FetchedCommit {
  readonly repo: string;
  readonly sha: string;
  readonly message: string;
  readonly at: number;
  readonly url: string;
}

export interface FetchedPullRequest {
  readonly repo: string;
  readonly number: number;
  readonly title: string;
  readonly at: number;
  readonly url: string;
  readonly merged: boolean;
}

interface RestCommit {
  readonly sha: string;
  readonly html_url: string;
  readonly commit: {
    readonly message: string;
    readonly author: { readonly name: string; readonly date: string } | null;
    readonly committer: { readonly date: string } | null;
  };
}

interface RestRepo {
  readonly full_name: string;
  readonly pushed_at: string;
}

interface SearchIssue {
  readonly number: number;
  readonly title: string;
  readonly html_url: string;
  readonly created_at: string;
  readonly repository_url: string;
  readonly pull_request: { readonly merged_at: string | null } | null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthBounds(month: string): { start: number; end: number } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`Invalid month "${month}" — expected YYYY-MM.`);
  }
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  return {
    start: new Date(year, monthIndex, 1).getTime(),
    end: new Date(year, monthIndex + 1, 1).getTime(),
  };
}

export function isoWithLocalOffset(ms: number): string {
  const date = new Date(ms);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export function buildMonthSnapshot(
  month: string,
  login: string,
  commits: readonly FetchedCommit[],
  pullRequests: readonly FetchedPullRequest[],
  fetchedAt: number,
  detail = "",
): GitHubMonthSnapshot {
  const { start, end } = monthBounds(month);
  const buckets = new Map<string, { commits: FetchedCommit[]; pullRequests: FetchedPullRequest[] }>();
  const bucketFor = (ms: number) => {
    if (ms < start || ms >= end) return null;
    const key = localDayKey(ms);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { commits: [], pullRequests: [] };
      buckets.set(key, bucket);
    }
    return bucket;
  };
  for (const commit of commits) {
    if (!/^Merge (pull request|branch|remote-tracking branch|tag)/i.test(commit.message)) {
      bucketFor(commit.at)?.commits.push(commit);
    }
  }
  for (const pullRequest of pullRequests) {
    bucketFor(pullRequest.at)?.pullRequests.push(pullRequest);
  }

  const days: GitHubDay[] = [];
  const repoTotals = new Map<string, { commits: number; days: Set<string>; lastAt: number }>();
  const cursor = new Date(start);
  while (cursor.getTime() < end) {
    const key = localDayKey(cursor.getTime());
    const bucket = buckets.get(key);
    const repoGroups = new Map<string, GitHubCommitEntry[]>();
    for (const commit of bucket?.commits ?? []) {
      let group = repoGroups.get(commit.repo);
      if (!group) {
        group = [];
        repoGroups.set(commit.repo, group);
      }
      group.push({ sha: commit.sha, message: commit.message, at: commit.at, url: commit.url });
      let total = repoTotals.get(commit.repo);
      if (!total) {
        total = { commits: 0, days: new Set<string>(), lastAt: 0 };
        repoTotals.set(commit.repo, total);
      }
      total.commits += 1;
      total.days.add(key);
      total.lastAt = Math.max(total.lastAt, commit.at);
    }
    days.push({
      date: key,
      commits: bucket?.commits.length ?? 0,
      repos: [...repoGroups.entries()].map(([repo, entries]) => ({ repo, commits: entries })),
      pullRequests: (bucket?.pullRequests ?? []).map((pullRequest) => {
        let total = repoTotals.get(pullRequest.repo);
        if (!total) {
          total = { commits: 0, days: new Set<string>(), lastAt: 0 };
          repoTotals.set(pullRequest.repo, total);
        }
        total.days.add(key);
        total.lastAt = Math.max(total.lastAt, pullRequest.at);
        return { ...pullRequest };
      }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const repos: GitHubRepoMonthActivity[] = [...repoTotals.entries()]
    .map(([repo, total]) => ({ repo, commits: total.commits, activeDays: total.days.size, lastAt: total.lastAt }))
    .sort((a, b) => b.commits - a.commits || a.repo.localeCompare(b.repo));

  const activeDays = days.filter((day) => day.commits > 0 || day.pullRequests.length > 0).length;
  const monthCommits = days.reduce((sum, day) => sum + day.commits, 0);
  const monthPullRequests = days.reduce((sum, day) => sum + day.pullRequests.length, 0);
  return {
    month,
    login,
    state: "ok",
    detail,
    fetchedAt,
    days,
    repos,
    totals: {
      commits: monthCommits,
      activeDays,
      repos: repos.length,
      pullRequests: monthPullRequests,
    },
  };
}

function setupSnapshot(month: string, cliInstalled: boolean): GitHubMonthSnapshot {
  const setup = cliInstalled
    ? {
        reason: "needs-auth" as const,
        command: "gh auth login",
        helpUrl: "https://docs.github.com/en/rest/quickstart",
      }
    : {
        reason: "missing-cli" as const,
        command: "brew install gh",
        helpUrl: "https://cli.github.com/",
      };
  return {
    month,
    login: "",
    state: "setup",
    detail: cliInstalled
      ? "GitHub CLI is installed, but azul-code could not find a sign-in. Run `gh auth login` in Terminal, then check again."
      : "GitHub CLI is not installed. Install `gh`, run `gh auth login` in Terminal, then check again. You can also launch azul-code with GH_TOKEN set.",
    fetchedAt: Date.now(),
    days: [],
    repos: [],
    totals: { commits: 0, activeDays: 0, repos: 0, pullRequests: 0 },
    setup,
  };
}

export function githubCliCandidates(platform = process.platform, pathValue = process.env.PATH): string[] {
  const candidates = ["gh"];
  if (platform === "darwin") {
    candidates.push("/opt/homebrew/bin/gh", "/usr/local/bin/gh");
  }
  const home = homedir();
  candidates.push(join(home, ".local", "bin", "gh"), join(home, "bin", "gh"));

  // Absolute PATH entries let packaged apps use a CLI installed outside the
  // small environment inherited from Finder/Dock launches.
  for (const directory of pathValue?.split(":") ?? []) {
    if (directory.startsWith("/")) candidates.push(join(directory, "gh"));
  }
  return [...new Set(candidates)];
}

async function resolveCredentials(): Promise<{ token: string | null; cliInstalled: boolean }> {
  const fromEnv = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnv?.trim()) return { token: fromEnv.trim(), cliInstalled: false };
  let cliInstalled = false;
  for (const executable of githubCliCandidates()) {
    try {
      await execFileAsync(executable, ["--version"], { timeout: 4_000 });
      cliInstalled = true;
      const { stdout } = await execFileAsync(executable, ["auth", "token"], { timeout: 10_000 });
      const token = stdout.trim();
      if (token) return { token, cliInstalled: true };
    } catch {
      // Try the next common installation path.
    }
  }
  return { token: null, cliInstalled };
}

async function ghApi<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tally-local",
    },
  });
  if (response.ok) return (await response.json()) as T;
  if (response.status === 401) {
    throw new Error("GitHub rejected the stored credentials. Run `gh auth login` to refresh them.");
  }
  if (response.status === 403 || response.status === 429) {
    throw new Error("GitHub API rate limit reached. Try again in a few minutes.");
  }
  throw new Error(`GitHub API request failed (HTTP ${response.status}).`);
}

async function ghApiPages<T>(path: string, token: string, maxItems = Number.POSITIVE_INFINITY): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES && items.length < maxItems; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const batch = await ghApi<T[]>(`${path}${separator}per_page=${PAGE_SIZE}&page=${page}`, token);
    items.push(...batch.slice(0, maxItems - items.length));
    if (batch.length < PAGE_SIZE) break;
  }
  return items;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

async function listCandidateRepos(token: string, monthStartMs: number): Promise<string[]> {
  const affiliation = encodeURIComponent("owner,collaborator,organization_member");
  const seen = new Set<string>();
  const candidates: string[] = [];
  const repos = await ghApiPages<RestRepo>(
    `/user/repos?sort=pushed&direction=desc&visibility=all&affiliation=${affiliation}`,
    token,
    MAX_REPOS,
  );
  for (const repo of repos) {
    if (seen.has(repo.full_name)) continue;
    seen.add(repo.full_name);
    if (new Date(repo.pushed_at).getTime() >= monthStartMs) candidates.push(repo.full_name);
  }
  return candidates.slice(0, MAX_REPOS);
}

async function fetchPullRequests(token: string, login: string, start: number, end: number): Promise<FetchedPullRequest[]> {
  const range = `${localDayKey(start)}..${localDayKey(end - 1)}`;
  const query = `type:pr author:${login} created:${range}`;
  const items: SearchIssue[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await ghApi<{ items: SearchIssue[] }>(
      `/search/issues?q=${encodeURIComponent(query)}&sort=created&order=asc&per_page=${PAGE_SIZE}&page=${page}`,
      token,
    );
    items.push(...result.items);
    if (result.items.length < PAGE_SIZE) break;
  }
  return items.map((item) => ({
    repo: item.repository_url.replace(/^.*\/repos\//, ""),
    number: item.number,
    title: item.title,
    at: new Date(item.created_at).getTime(),
    url: item.html_url,
    merged: Boolean(item.pull_request?.merged_at),
  }));
}

const cache = new Map<string, { snapshot: GitHubMonthSnapshot; at: number }>();

export async function fetchGithubMonth(month: string, refresh = false): Promise<GitHubMonthSnapshot> {
  monthBounds(month);
  const cached = cache.get(month);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL) return cached.snapshot;

  const credentials = await resolveCredentials();
  if (!credentials.token) return setupSnapshot(month, credentials.cliInstalled);
  const token = credentials.token;

  const { start, end } = monthBounds(month);
  const user = await ghApi<{ login: string }>("/user", token);

  const repos = await listCandidateRepos(token, start);
  let failedRepos = 0;
  const commits = (
    await mapLimit(repos, REPO_CONCURRENCY, async (repo) => {
      try {
        const items = await ghApiPages<RestCommit>(
          `/repos/${repo}/commits?author=${encodeURIComponent(user.login)}` +
            `&since=${encodeURIComponent(isoWithLocalOffset(start))}` +
            `&until=${encodeURIComponent(isoWithLocalOffset(end))}`,
          token,
        );
        return items.map((item) => ({
          repo,
          sha: item.sha,
          message: (item.commit.message.split("\n")[0] ?? "").trim(),
          at: new Date(item.commit.author?.date ?? item.commit.committer?.date ?? 0).getTime(),
          url: item.html_url,
        }));
      } catch {
        failedRepos += 1;
        return [];
      }
    })
  ).flat();

  let pullRequests: FetchedPullRequest[] = [];
  let pullRequestsFailed = false;
  try {
    pullRequests = await fetchPullRequests(token, user.login, start, end);
  } catch {
    pullRequestsFailed = true;
  }

  const warnings: string[] = [];
  if (failedRepos > 0) warnings.push(`${failedRepos} ${failedRepos === 1 ? "repository" : "repositories"} could not be read.`);
  if (pullRequestsFailed) warnings.push("Pull requests could not be read.");
  const snapshot = buildMonthSnapshot(month, user.login, commits, pullRequests, Date.now(), warnings.join(" "));
  cache.set(month, { snapshot, at: Date.now() });
  return snapshot;
}
