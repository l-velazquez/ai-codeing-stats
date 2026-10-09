import { ChevronRight, FolderCode } from "lucide-react";
import { ProviderDots } from "@renderer/components/data/ProviderDots";
import { compact, money } from "@renderer/format";
import { openPath } from "@renderer/lib/bridge";
import type { ProjectStat } from "@shared/types";
import type { ProjectRepoMatch, RepoActivity } from "@shared/projectRepos";

/** Undefined hides the column (Overview); null means no repository matched. */
export type ProjectGithub = { match: ProjectRepoMatch; activity: RepoActivity } | null | "loading";

function GithubCell({ project, github }: { project: ProjectStat; github: ProjectGithub }) {
  if (github === "loading") return <div className="numeric-cell project-commits"><strong>…</strong><span>Reading GitHub</span></div>;
  if (!github) return <div className="numeric-cell project-commits is-unmatched" title="No GitHub repository matched this workspace's git remote or folder name"><strong>—</strong><span>No repo matched</span></div>;
  const { match, activity } = github;
  const perCommit = activity.commits > 0 ? `${money(project.cost / activity.commits)} / commit` : activity.pullRequests > 0 ? `${activity.pullRequests} PR, no commits` : "No commits";
  return (
    <div className="numeric-cell project-commits" title={`${match.repo} · matched by ${match.via === "remote" ? "git remote" : "folder name"}`}>
      <strong>{activity.commits} {activity.commits === 1 ? "commit" : "commits"}</strong>
      <span>{perCommit}</span>
    </div>
  );
}

export function ProjectRow({ project, maxCost, github }: { project: ProjectStat; maxCost: number; github?: ProjectGithub }) {
  return (
    <button
      className={github === undefined ? "data-row project-row" : "data-row project-row project-row--github"}
      onClick={() => void window.azulCode?.openPath(project.path)}
      disabled={!project.path || !window.azulCode}
      title={project.path || "No workspace path recorded"}
    >
      <div className="project-rank-icon"><FolderCode size={16} /></div>
      <div className="project-name"><strong>{project.name}</strong><span>{project.path || "Unassigned workspace"}</span></div>
      <div className="project-spend-bar"><i style={{ width: `${Math.max(3, (project.cost / Math.max(0.01, maxCost)) * 100)}%` }} /></div>
      <ProviderDots providers={project.providers} />
      <div className="numeric-cell"><strong>{money(project.cost)}</strong><span>{compact(project.tokens)} tokens</span></div>
      {github === undefined ? null : <GithubCell project={project} github={github} />}
      <ChevronRight className="row-chevron" size={15} />
    </button>
  );
}
