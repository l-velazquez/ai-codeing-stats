import { money } from "@renderer/format";
import { ShipStrips } from "@renderer/components/github/ShipStrips";
import type { ContributionInsights, DaySpend } from "@shared/contributionInsights";
import type { GitHubMonthSnapshot } from "@shared/types";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * The month as two aligned strips: what shipped on top, what the AI sessions
 * cost underneath. They share the day axis and nothing else -- each strip is
 * scaled to its own peak and says so, rather than pretending commits and
 * dollars sit on one y-scale. Each column is one button so the hover target is
 * the full height of the day, not the sliver of a short bar.
 */
export function ShipRibbon({
  data,
  spend,
  insights,
  todayKey,
  onJump,
}: {
  data: GitHubMonthSnapshot;
  spend: ReadonlyMap<string, DaySpend>;
  insights: ContributionInsights;
  todayKey: string;
  onJump: (date: string) => void;
}) {
  const { commits, pullRequests, activeDays } = data.totals;

  return (
    <section className="panel ship-ribbon" aria-label="Month at a glance">
      <div className="ship-headline">
        <div className="ship-figure">
          <span>Shipped</span>
          <strong>{commits}</strong>
          <small>{commits === 1 ? "Commit" : "Commits"} across {plural(data.totals.repos, "project")}</small>
        </div>
        <div className="ship-figure">
          <span>Pull requests</span>
          <strong>{pullRequests}</strong>
          <small>{pullRequests > 0 ? `${insights.mergedPullRequests} merged so far` : "None opened"}</small>
        </div>
        <div className="ship-figure">
          <span>Active days</span>
          <strong>{activeDays}<em>/{data.days.filter((day) => day.date <= todayKey).length}</em></strong>
          <small>Days with a commit or pull request</small>
        </div>
        <div className="ship-figure ship-figure--spend">
          <span>AI spend</span>
          <strong>{money(insights.aiCost)}</strong>
          <small>{plural(insights.aiSessions, "session")} on this Mac</small>
        </div>
      </div>

      <ShipStrips days={data.days} spend={spend} todayKey={todayKey} onJump={onJump} />
      <div className="ship-legend">
        <span><i className="ship-key ship-key--commit" />Commits</span>
        <span><i className="ship-key ship-key--pr" />Pull request, filled once merged</span>
        <span><i className="ship-key ship-key--spend" />AI spend</span>
        <span className="ship-legend-hint">Each strip is scaled to its own peak · click a day to jump to it</span>
      </div>
    </section>
  );
}
