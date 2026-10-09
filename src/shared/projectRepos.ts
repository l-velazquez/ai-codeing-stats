import type { GitHubMonthSnapshot } from "./types";

/** owner/name from a GitHub remote URL in any of git's usual spellings. */
export function parseGithubRemote(url: string): string | null {
  const match = /github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(url.trim());
  return match ? `${match[1]}/${match[2]}` : null;
}

/** "AI-Coding Stats", "ai_coding_stats" and "aicodingstats" all compare equal. */
export function normalizeProjectName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function folderName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "";
}

export interface ProjectRepoMatch {
  readonly repo: string;
  /** "remote" read the workspace's git origin; "folder" only matched names. */
  readonly via: "remote" | "folder";
}

/**
 * The GitHub repository a local AI workspace corresponds to. The workspace's
 * own git remote is authoritative when there is one -- a folder can be called
 * anything. Without it, fall back to comparing the folder name with each
 * repository's name, and only accept an unambiguous match: two owners with a
 * "webapp" repo is a guess, not a match.
 */
export function matchProjectRepo(
  project: { readonly name: string; readonly path: string },
  remote: string | null | undefined,
  repos: readonly string[],
): ProjectRepoMatch | null {
  if (remote) {
    const exact = repos.find((repo) => repo.toLowerCase() === remote.toLowerCase());
    return { repo: exact ?? remote, via: "remote" };
  }
  const wanted = normalizeProjectName(folderName(project.path) || project.name);
  if (!wanted) return null;
  const candidates = repos.filter((repo) => normalizeProjectName(repo.split("/").at(-1) ?? repo) === wanted);
  return candidates.length === 1 ? { repo: candidates[0], via: "folder" } : null;
}

export interface RepoActivity {
  readonly commits: number;
  readonly pullRequests: number;
}

/** Commits and pull requests per repository at or after `since`, across months. */
export function repoActivitySince(months: readonly GitHubMonthSnapshot[], since: number): Map<string, RepoActivity> {
  const totals = new Map<string, { commits: number; pullRequests: number }>();
  const totalFor = (repo: string) => {
    let total = totals.get(repo);
    if (!total) {
      total = { commits: 0, pullRequests: 0 };
      totals.set(repo, total);
    }
    return total;
  };
  for (const month of months) {
    for (const day of month.days) {
      for (const group of day.repos) {
        const count = group.commits.filter((commit) => commit.at >= since).length;
        if (count > 0) totalFor(group.repo).commits += count;
      }
      for (const pullRequest of day.pullRequests) {
        if (pullRequest.at >= since) totalFor(pullRequest.repo).pullRequests += 1;
      }
    }
  }
  return totals;
}
