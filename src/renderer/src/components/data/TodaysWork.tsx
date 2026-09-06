import { ChevronRight, GitBranch, GitPullRequest } from "lucide-react";
import type { GitHubDay, GitHubMonthSnapshot } from "@shared/types";
import type { DayCost } from "@renderer/hooks/useDailyCostIndex";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { localDayKey, money } from "@renderer/format";

/**
 * Spend and output for the same day, side by side.
 *
 * This pairing already existed as a small chip buried on the Contributions
 * page, and it is the one thing in the app that connects what the money bought
 * to what shipped. It is not a claim of causation -- just the two figures on
 * the same axis.
 */
interface DayProject {
  repo: string;
  commits: number;
  pullRequests: number;
}

/** Every project touched today, including ones that only saw a pull request. */
function projectsForDay(day: GitHubDay): DayProject[] {
  const projects = new Map<string, DayProject>();
  const projectFor = (repo: string) => {
    let project = projects.get(repo);
    if (!project) {
      project = { repo, commits: 0, pullRequests: 0 };
      projects.set(repo, project);
    }
    return project;
  };
  for (const group of day.repos) projectFor(group.repo).commits += group.commits.length;
  for (const pullRequest of day.pullRequests) projectFor(pullRequest.repo).pullRequests += 1;
  return [...projects.values()];
}

function projectSummary(project: DayProject): string {
  const parts: string[] = [];
  if (project.commits > 0) parts.push(`${project.commits} ${project.commits === 1 ? "commit" : "commits"}`);
  if (project.pullRequests > 0) parts.push(`${project.pullRequests} ${project.pullRequests === 1 ? "pull request" : "pull requests"}`);
  return parts.join(" · ");
}

export function TodaysWork({
  github,
  spendToday,
  onOpenContributions,
}: {
  github: GitHubMonthSnapshot | null;
  spendToday: DayCost | null;
  onOpenContributions: () => void;
}) {
  const key = localDayKey();
  const day = github?.days.find((entry) => entry.date === key) ?? null;
  const commits = day?.commits ?? 0;
  const pullRequests = day?.pullRequests.length ?? 0;
  const nothingYet = commits === 0 && pullRequests === 0 && (spendToday?.sessions ?? 0) === 0;
  const projects = day ? projectsForDay(day) : [];

  return (
    <section className="panel list-panel todays-work">
      <CardTitle
        action={
          <button className="text-action" onClick={onOpenContributions}>
            Full month <ChevronRight size={13} />
          </button>
        }
      >
        Today
      </CardTitle>

      {nothingYet ? (
        <p className="todays-work-empty">Nothing recorded yet today. Start a coding session and it will show up here.</p>
      ) : (
        <>
          <div className="todays-work-figures">
            <div>
              <span>Spent</span>
              <strong>{money(spendToday?.cost ?? 0)}</strong>
              <small>{spendToday?.sessions ?? 0} sessions</small>
            </div>
            <div>
              <span>Committed</span>
              <strong>{commits}</strong>
              <small>{commits === 1 ? "commit" : "commits"}</small>
            </div>
            <div>
              <span>Pull requests</span>
              <strong>{pullRequests}</strong>
              <small>opened today</small>
            </div>
          </div>

          {projects.length > 0 ? (
            <div className="todays-work-repos">
              {projects.map((project) => (
                <div key={project.repo} title={`${project.repo} — ${projectSummary(project)}`}>
                  {project.commits > 0 ? <GitBranch size={12} /> : <GitPullRequest size={12} />}
                  <span>{project.repo.split("/")[1] ?? project.repo}</span>
                  <small>{project.commits > 0 ? project.commits : null}{project.pullRequests > 0 ? `${project.commits > 0 ? " · " : ""}${project.pullRequests} PR` : ""}</small>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
