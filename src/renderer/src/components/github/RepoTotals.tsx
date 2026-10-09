import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { EmptyState } from "@renderer/components/primitives/EmptyState";
import type { ContributionInsights } from "@shared/contributionInsights";
import type { GitHubMonthSnapshot } from "@shared/types";

/**
 * One row per project with its share of the month and a day-by-day strip.
 * The strip replaces a bare bar: two projects with the same commit count can be
 * one burst or steady daily work, and only the strip tells them apart.
 */
export function RepoTotals({ data, insights }: { data: GitHubMonthSnapshot; insights: ContributionInsights }) {
  const total = Math.max(1, data.totals.commits);
  return (
    <div className="panel gh-repos-panel">
      <CardTitle action={<span className="muted-label">{data.totals.repos} projects</span>}>By project</CardTitle>
      <div className="gh-repo-list">
        {data.repos.map((repo) => {
          const strip = insights.repoStrips.get(repo.repo) ?? [];
          const peak = Math.max(1, ...strip);
          const share = Math.round((repo.commits / total) * 100);
          return (
            <button key={repo.repo} className="gh-repo-row" onClick={() => void window.azulCode?.openUrl(`https://github.com/${repo.repo}`)} title={`Open ${repo.repo} on GitHub`}>
              <div className="gh-repo-row-name">
                <strong>{repo.repo.split("/")[1] ?? repo.repo}</strong>
                <span>{repo.commits > 0 ? `${share}% of commits` : "pull requests only"} · {repo.activeDays}d active</span>
              </div>
              <div className="numeric-cell"><strong>{repo.commits}</strong></div>
              <span className="gh-repo-strip" aria-hidden="true">
                {data.days.map((day, index) => (
                  <i key={day.date} style={{ opacity: strip[index] > 0 ? 0.35 + 0.65 * (strip[index] / peak) : undefined }} className={strip[index] > 0 ? "is-on" : undefined} />
                ))}
              </span>
            </button>
          );
        })}
        {data.repos.length === 0 ? <EmptyState compactMode label="No project activity this month" /> : null}
      </div>
    </div>
  );
}
