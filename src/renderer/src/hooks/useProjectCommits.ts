import { useEffect, useState } from "react";
import type { StatsSnapshot } from "@shared/types";
import { currentMonthKey, shiftMonthKey } from "@shared/invoice";
import { matchProjectRepo, repoActivitySince, type ProjectRepoMatch, type RepoActivity } from "@shared/projectRepos";
import { fetchGithubMonth, fetchGithubRemotes, scan } from "@renderer/lib/bridge";

/** "All time" still has to stop somewhere; each month is a round of API calls. */
const MAX_MONTHS = 6;

export interface ProjectCommits {
  readonly state: "loading" | "ok" | "setup" | "error";
  /** Keyed by project path, or name for a project without one. */
  readonly byProject: ReadonlyMap<string, { match: ProjectRepoMatch; activity: RepoActivity; cost: number }>;
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
  const { projects, since: usageSince, generatedAt } = snapshot;
  const now = new Date(generatedAt);
  const earliest = new Date(now.getFullYear(), now.getMonth() - (MAX_MONTHS - 1), 1).getTime();
  const since = Math.max(usageSince ?? earliest, earliest);
  const [result, setResult] = useState<ProjectCommits>({ state: "loading", byProject: new Map(), since });

  useEffect(() => {
    let cancelled = false;
    const months = monthsBetween(since, new Date(generatedAt));
    const paths = projects.map((project) => project.path).filter(Boolean);
    setResult((previous) => ({ ...previous, state: "loading", since }));
    void Promise.all([
      Promise.all(months.map((month) => fetchGithubMonth(month))),
      fetchGithubRemotes(paths).catch(() => ({}) as Record<string, string | null>),
      // All-time project totals remain in the ledger; the ratio needs spend
      // from exactly the same bounded period as the GitHub denominator.
      usageSince === since ? Promise.resolve({ projects }) : scan("all", false, since),
    ])
      .then(([snapshots, remotes, usage]) => {
        if (cancelled) return;
        if (snapshots.some((month) => month.state === "setup")) {
          setResult({ state: "setup", byProject: new Map(), since });
          return;
        }
        const activity = repoActivitySince(snapshots, since);
        const repos = [...activity.keys()];
        const costs = new Map(usage.projects.map((project) => [projectKey(project), project.cost]));
        const byProject = new Map<string, { match: ProjectRepoMatch; activity: RepoActivity; cost: number }>();
        for (const project of projects) {
          const match = matchProjectRepo(project, project.path ? remotes[project.path] : null, repos);
          if (match) byProject.set(projectKey(project), {
            match,
            activity: activity.get(match.repo) ?? { commits: 0, pullRequests: 0 },
            cost: costs.get(projectKey(project)) ?? 0,
          });
        }
        setResult({ state: "ok", byProject, since });
      })
      .catch(() => {
        if (!cancelled) setResult({ state: "error", byProject: new Map(), since });
      });
    return () => {
      cancelled = true;
    };
  }, [projects, usageSince, generatedAt, since]);

  return result;
}
