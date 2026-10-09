import { useEffect, useState } from "react";
import type { GitHubMonthSnapshot, StatsSnapshot } from "@shared/types";
import { currentMonthKey, shiftMonthKey } from "@shared/invoice";
import { matchProjectRepo, repoActivitySince, type ProjectRepoMatch, type RepoActivity } from "@shared/projectRepos";
import { fetchGithubMonth, fetchGithubRemotes } from "@renderer/lib/bridge";

/** "All time" still has to stop somewhere; each month is a round of API calls. */
const MAX_MONTHS = 6;

export interface ProjectCommits {
  readonly state: "loading" | "ok" | "setup" | "error";
  /** Keyed by project path, or name for a project without one. */
  readonly byProject: ReadonlyMap<string, { match: ProjectRepoMatch; activity: RepoActivity }>;
  /** Start of the window the commit counts cover. */
  readonly since: number;
}

export function projectKey(project: { readonly path: string; readonly name: string }): string {
  return project.path || project.name;
}

function monthsBetween(since: number, now: Date): string[] {
  const months: string[] = [];
  let month = currentMonthKey(now);
  const first = currentMonthKey(new Date(since));
  while (months.length < MAX_MONTHS) {
    months.unshift(month);
    if (month <= first) break;
    month = shiftMonthKey(month, -1);
  }
  return months;
}

/**
 * GitHub commits for each AI workspace over the same window as its spend, so
 * the Projects page can put "what it cost" next to "what shipped".
 */
export function useProjectCommits(snapshot: StatsSnapshot): ProjectCommits {
  const now = new Date();
  const since = snapshot.since ?? new Date(now.getFullYear(), now.getMonth() - (MAX_MONTHS - 1), 1).getTime();
  const [result, setResult] = useState<ProjectCommits>({ state: "loading", byProject: new Map(), since });

  useEffect(() => {
    let cancelled = false;
    const months = monthsBetween(since, new Date());
    const paths = snapshot.projects.map((project) => project.path).filter(Boolean);
    setResult((previous) => ({ ...previous, state: "loading", since }));
    void Promise.all([
      Promise.all(months.map((month) => fetchGithubMonth(month))),
      fetchGithubRemotes(paths).catch(() => ({}) as Record<string, string | null>),
    ])
      .then(([snapshots, remotes]: [GitHubMonthSnapshot[], Record<string, string | null>]) => {
        if (cancelled) return;
        if (snapshots.some((month) => month.state === "setup")) {
          setResult({ state: "setup", byProject: new Map(), since });
          return;
        }
        const activity = repoActivitySince(snapshots, since);
        const repos = [...activity.keys()];
        const byProject = new Map<string, { match: ProjectRepoMatch; activity: RepoActivity }>();
        for (const project of snapshot.projects) {
          const match = matchProjectRepo(project, project.path ? remotes[project.path] : null, repos);
          if (match) byProject.set(projectKey(project), { match, activity: activity.get(match.repo) ?? { commits: 0, pullRequests: 0 } });
        }
        setResult({ state: "ok", byProject, since });
      })
      .catch(() => {
        if (!cancelled) setResult({ state: "error", byProject: new Map(), since });
      });
    return () => {
      cancelled = true;
    };
  }, [snapshot.projects, since]);

  return result;
}
