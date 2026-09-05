import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { EmptyState } from "@renderer/components/primitives/EmptyState";
import { openUrl } from "@renderer/lib/bridge";
import type { GitHubMonthSnapshot } from "@shared/types";

export function RepoTotals({ data }: { data: GitHubMonthSnapshot }) {
  const max = Math.max(1, data.repos[0]?.commits ?? 1);
  return (
    <div className="panel gh-repos-panel">
      <CardTitle action={<span className="muted-label">{data.totals.repos} projects</span>}>By project</CardTitle>
      <div className="gh-repo-list">
        {data.repos.map((repo) => (
          <button key={repo.repo} className="gh-repo-row" onClick={() => void window.tokenary?.openUrl(`https://github.com/${repo.repo}`)} title={`Open ${repo.repo} on GitHub`}>
            <div className="gh-repo-row-name"><strong>{repo.repo.split("/")[1] ?? repo.repo}</strong><span>{repo.repo}</span></div>
            <span className="mini-bar"><i style={{ width: `${Math.max(4, (repo.commits / max) * 100)}%` }} /></span>
            <div className="numeric-cell"><strong>{repo.commits}</strong><span>{repo.activeDays}d active</span></div>
          </button>
        ))}
        {data.repos.length === 0 ? <EmptyState compactMode label="No project activity this month" /> : null}
      </div>
    </div>
  );
}
