import { FolderCode } from "lucide-react";
import { ProjectRow } from "@renderer/components/data/ProjectRow";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { money } from "@renderer/format";
import type { StatsSnapshot } from "@shared/types";

export function ProjectsPage({ snapshot }: { snapshot: StatsSnapshot }) {
  const maxCost = snapshot.projects[0]?.cost ?? 1;
  return (
    <div className="page-stack">
      <section className="project-summary panel">
        <div><span className="hero-label">Workspaces detected</span><strong>{snapshot.projects.length}</strong><p>Local paths stay on this Mac.</p></div>
        <div className="project-summary-stat"><span>Most active</span><strong>{snapshot.projects[0]?.name ?? "—"}</strong><small>{snapshot.projects[0] ? money(snapshot.projects[0].cost) : "$0.00"}</small></div>
        <div className="project-summary-stat"><span>Average / project</span><strong>{money(snapshot.summary.cost / Math.max(1, snapshot.projects.length))}</strong><small>API equivalent</small></div>
      </section>
      <section className="panel list-panel project-panel">
        <CardTitle action={<span className="muted-label">click a row to open</span>}>Project ledger</CardTitle>
        {snapshot.projects.map((project) => <ProjectRow key={project.path || project.name} project={project} maxCost={maxCost} />)}
      </section>
    </div>
  );
}
