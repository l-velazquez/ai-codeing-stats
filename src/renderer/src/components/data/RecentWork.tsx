import { ChevronRight, GitBranch, GitPullRequest } from "lucide-react";
import type { GitHubDay } from "@shared/types";
import type { DayCost } from "@renderer/hooks/useDailyCostIndex";
import type { RecentGithubDays } from "@renderer/hooks/useRecentGithubDays";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { ShipStrips } from "@renderer/components/github/ShipStrips";
import { localDayKey, money } from "@renderer/format";

/**
 * The last two weeks of spend and output on the same day axis, with today's
 * figures on top. It replaced a today-only card: a single day said little about
 * whether the money was turning into shipped work, and was empty every morning.
 * It is not a claim of causation -- just the two series side by side.
 */
interface DayProject {
  repo: string;
  commits: number;
  pullRequests: number;
}

/** Every project touched on a day, including ones that only saw a pull request. */
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

/** Empty GitHub days, so the spend strip still draws when GitHub is not connected. */
function blankDays(count: number): GitHubDay[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => ({
    date: localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1 - index))),
    commits: 0,
    repos: [],
    pullRequests: [],
  }));
}

export const RECENT_DAYS = 14;

export function RecentWork({
  github,
  spend,
  onOpenContributions,
}: {
  github: RecentGithubDays;
  spend: ReadonlyMap<string, DayCost>;
  onOpenContributions: () => void;
}) {
  const todayKey = localDayKey();
  const days = github.state === "ok" && github.days.length > 0 ? github.days : blankDays(RECENT_DAYS);
  const today = days.find((day) => day.date === todayKey) ?? null;
  const spendToday = spend.get(todayKey) ?? null;
  const windowCommits = days.reduce((sum, day) => sum + day.commits, 0);
  const windowCost = days.reduce((sum, day) => sum + (spend.get(day.date)?.cost ?? 0), 0);
  const projects = today ? projectsForDay(today) : [];
  const githubNote = github.state === "setup"
    ? "Connect GitHub on Contributions to see commits here."
    : github.state === "error" ? "GitHub activity could not be loaded." : null;

  return (
    <section className="panel recent-work" aria-label="Last 14 days">
      <CardTitle
        action={
          <button className="text-action" onClick={onOpenContributions}>
            Contributions <ChevronRight size={13} />
          </button>
        }
      >
        Last {RECENT_DAYS} days
      </CardTitle>

      <div className="todays-work-figures recent-work-figures">
        <div>
          <span>Spent today</span>
          <strong>{money(spendToday?.cost ?? 0)}</strong>
          <small>{spendToday?.sessions ?? 0} {spendToday?.sessions === 1 ? "session" : "sessions"}</small>
        </div>
        <div>
          <span>Committed today</span>
          <strong>{github.state === "ok" ? today?.commits ?? 0 : "—"}</strong>
          <small>{today && today.pullRequests.length > 0 ? `${today.pullRequests.length} pull ${today.pullRequests.length === 1 ? "request" : "requests"}` : "commits"}</small>
        </div>
        <div>
          <span>{RECENT_DAYS}-day commits</span>
          <strong>{github.state === "ok" ? windowCommits : "—"}</strong>
          <small>{github.state === "ok" ? `${days.filter((day) => day.commits > 0 || day.pullRequests.length > 0).length} active days` : "GitHub not connected"}</small>
        </div>
        <div>
          <span>{RECENT_DAYS}-day AI spend</span>
          <strong>{money(windowCost)}</strong>
          <small>{windowCommits > 0 ? `${money(windowCost / windowCommits)} per commit` : "API equivalent"}</small>
        </div>
      </div>

      <ShipStrips days={days} spend={spend} todayKey={todayKey} onJump={onOpenContributions} compact />

      {githubNote ? <p className="recent-work-note">{githubNote}</p> : null}
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
    </section>
  );
}
