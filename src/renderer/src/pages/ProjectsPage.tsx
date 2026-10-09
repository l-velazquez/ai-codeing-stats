import { ProjectRow } from "@renderer/components/data/ProjectRow";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { money, shortDate } from "@renderer/format";
import { projectKey, useProjectCommits } from "@renderer/hooks/useProjectCommits";
import type { StatsSnapshot } from "@shared/types";

export function ProjectsPage({ snapshot }: { snapshot: StatsSnapshot }) {
  const maxCost = snapshot.projects[0]?.cost ?? 1;
  const github = useProjectCommits(snapshot);

  // Cost per commit only over projects that have both, so a workspace with no
  // repository does not inflate the figure with spend that never could ship.
  let pairedCost = 0;
  let pairedCommits = 0;
  for (const project of snapshot.projects) {
    const entry = github.byProject.get(projectKey(project));
    if (entry && entry.activity.commits > 0) {
      pairedCost += project.cost;
      pairedCommits += entry.activity.commits;
    }
  }
  const matched = github.byProject.size;

  const githubStat = github.state === "ok"
    ? { value: pairedCommits > 0 ? money(pairedCost / pairedCommits) : "—", detail: `${matched} of ${snapshot.projects.length} projects matched to GitHub` }
    : github.state === "setup"
      ? { value: "—", detail: "Connect GitHub on Contributions" }
      : github.state === "error"
        ? { value: "—", detail: "GitHub activity could not be loaded" }
        : { value: "…", detail: "Reading GitHub" };

  return (
    <div className="page-stack">
      <section className="project-summary panel">
        <div><span className="hero-label">Workspaces detected</span><strong>{snapshot.projects.length}</strong><p>Local paths stay on this Mac.</p></div>
        <div className="project-summary-stat"><span>Most active</span><strong>{snapshot.projects[0]?.name ?? "—"}</strong><small>{snapshot.projects[0] ? money(snapshot.projects[0].cost) : "$0.00"}</small></div>
        <div className="project-summary-stat"><span>Average / project</span><strong>{money(snapshot.summary.cost / Math.max(1, snapshot.projects.length))}</strong><small>API equivalent</small></div>
        <div className="project-summary-stat"><span>AI cost per commit</span><strong>{githubStat.value}</strong><small>{githubStat.detail}</small></div>
      </section>
      <section className="panel list-panel project-panel">
        <CardTitle action={<span className="muted-label">commits since {shortDate(github.since)} · matched by git remote, then folder name</span>}>Project ledger</CardTitle>
        {snapshot.projects.map((project) => {
          const entry = github.byProject.get(projectKey(project)) ?? null;
          return (
            <ProjectRow
              key={projectKey(project)}
              project={project}
              maxCost={maxCost}
              github={github.state === "loading" ? "loading" : github.state === "ok" ? entry : undefined}
            />
          );
        })}
      </section>
    </div>
  );
}
