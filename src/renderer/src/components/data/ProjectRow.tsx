import { ChevronRight, FolderCode } from "lucide-react";
import { ProviderDots } from "@renderer/components/data/ProviderDots";
import { compact, money } from "@renderer/format";
import { openPath } from "@renderer/lib/bridge";
import type { ProjectStat } from "@shared/types";

export function ProjectRow({ project, maxCost }: { project: ProjectStat; maxCost: number }) {
  return (
    <button
      className="data-row project-row"
      onClick={() => void window.azulCode?.openPath(project.path)}
      disabled={!project.path || !window.azulCode}
      title={project.path || "No workspace path recorded"}
    >
      <div className="project-rank-icon"><FolderCode size={16} /></div>
      <div className="project-name"><strong>{project.name}</strong><span>{project.path || "Unassigned workspace"}</span></div>
      <div className="project-spend-bar"><i style={{ width: `${Math.max(3, (project.cost / Math.max(0.01, maxCost)) * 100)}%` }} /></div>
      <ProviderDots providers={project.providers} />
      <div className="numeric-cell"><strong>{money(project.cost)}</strong><span>{compact(project.tokens)} tokens</span></div>
      <ChevronRight className="row-chevron" size={15} />
    </button>
  );
}
