import type { CSSProperties } from "react";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { hourLabel, WEEKDAYS, type ContributionInsights } from "@shared/contributionInsights";

const HOUR_TICKS = [0, 6, 12, 18];

/**
 * When commits land: weekday rows by hour-of-day columns, dot area by count.
 * The calendar this replaced answered "which days", which the ribbon above
 * already answers; this answers "which hours", which nothing else does.
 */
export function ShipClock({ insights }: { insights: ContributionInsights }) {
  const { punch, punchPeak, peakHour, busiestWeekday } = insights;
  const summary = punchPeak === 0
    ? "No commits yet"
    : `Mostly ${WEEKDAYS[busiestWeekday ?? 0]}s around ${hourLabel(peakHour ?? 0)}`;
  return (
    <div className="panel ship-clock">
      <CardTitle action={<span className="muted-label">{summary}</span>}>When you ship</CardTitle>
      <div className="ship-clock-grid" role="table" aria-label="Commits by weekday and hour">
        {punch.map((row, weekday) => (
          <div className="ship-clock-row" role="row" key={weekday}>
            <span className="ship-clock-day" role="rowheader">{WEEKDAYS[weekday].slice(0, 1)}</span>
            {row.map((count, hour) => (
              <span
                key={hour}
                role="cell"
                className={count > 0 ? "ship-clock-cell has-commits" : "ship-clock-cell"}
                title={count > 0 ? `${WEEKDAYS[weekday]} ${hourLabel(hour)}: ${count} ${count === 1 ? "commit" : "commits"}` : undefined}
                aria-label={count > 0 ? `${WEEKDAYS[weekday]} ${hourLabel(hour)}, ${count} commits` : undefined}
                style={{ "--size": punchPeak > 0 ? Math.sqrt(count / punchPeak) : 0 } as CSSProperties}
              />
            ))}
          </div>
        ))}
        <div className="ship-clock-row ship-clock-hours" aria-hidden="true">
          <span />
          {Array.from({ length: 24 }, (_, hour) => <span key={hour}>{HOUR_TICKS.includes(hour) ? hourLabel(hour) : ""}</span>)}
        </div>
      </div>
    </div>
  );
}
