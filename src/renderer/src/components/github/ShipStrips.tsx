import type { CSSProperties } from "react";
import { money } from "@renderer/format";
import { dayLabel } from "@shared/invoice";
import type { DaySpend } from "@shared/contributionInsights";
import type { GitHubDay } from "@shared/types";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Commits rising from a centre line and AI spend hanging below it, one column
 * per day. The two strips share the day axis and nothing else -- each is
 * scaled to its own peak and says so, rather than pretending commits and
 * dollars sit on one y-scale. Each column is one button so the hover target is
 * the full height of the day, not the sliver of a short bar.
 *
 * `compact` is the Overview variant: shorter strips, and every column labelled
 * with its weekday since there are only a couple of weeks of them.
 */
export function ShipStrips({
  days,
  spend,
  todayKey,
  onJump,
  compact = false,
}: {
  days: readonly GitHubDay[];
  spend: ReadonlyMap<string, DaySpend>;
  todayKey: string;
  onJump: (date: string) => void;
  compact?: boolean;
}) {
  const commitPeak = Math.max(1, ...days.map((day) => day.commits));
  const costPeak = Math.max(0, ...days.map((day) => spend.get(day.date)?.cost ?? 0));
  const hasSpend = costPeak > 0;
  return (
      <div className={compact ? "ship-plot ship-plot--compact" : "ship-plot"} style={{ "--days": days.length } as CSSProperties}>
        <div className="ship-axis-label ship-axis-label--top">
          <span>Commits</span><small>peak {commitPeak}</small>
        </div>
        <div className="ship-axis-label ship-axis-label--bottom">
          <span>AI spend</span><small>{hasSpend ? `peak ${money(costPeak)}` : "no sessions"}</small>
        </div>
        <div className="ship-columns">
          {days.map((day) => {
            const future = day.date > todayKey;
            const daySpend = spend.get(day.date);
            const cost = daySpend?.cost ?? 0;
            const dayNumber = Number(day.date.slice(8, 10));
            const weekday = new Date(Number(day.date.slice(0, 4)), Number(day.date.slice(5, 7)) - 1, dayNumber).getDay();
            const merged = day.pullRequests.filter((pullRequest) => pullRequest.merged).length;
            // Spend-only days stay hoverable: there is no ledger card to jump
            // to, but the tooltip is the only place their cost is shown.
            const hasCard = day.commits > 0 || day.pullRequests.length > 0;
            const summary = future
              ? `${day.date}, not yet`
              : `${day.date}: ${plural(day.commits, "commit")}, ${plural(day.pullRequests.length, "pull request")}, ${money(cost)} AI spend`;
            const classes = [
              "ship-day",
              weekday === 0 || weekday === 6 ? "is-weekend" : "",
              day.date === todayKey ? "is-today" : "",
              future ? "is-future" : "",
            ].filter(Boolean).join(" ");
            return (
              <button
                key={day.date}
                className={classes}
                disabled={future}
                aria-label={summary}
                data-jump={hasCard ? "true" : undefined}
                onClick={() => {
                  if (hasCard) onJump(day.date);
                }}
                style={{
                  "--commit": day.commits / commitPeak,
                  "--cost": hasSpend ? cost / costPeak : 0,
                } as CSSProperties}
              >
                <span className="ship-up">
                  {day.pullRequests.length > 0 ? (
                    <i className={merged > 0 ? "ship-pr is-merged" : "ship-pr"} aria-hidden="true" />
                  ) : null}
                  {day.commits > 0 ? <b /> : null}
                </span>
                <span className="ship-date" aria-hidden="true">{compact ? WEEKDAY_INITIALS[weekday] : dayNumber === 1 || dayNumber % 5 === 0 || day.date === todayKey ? dayNumber : ""}</span>
                <span className="ship-down">{cost > 0 ? <b /> : null}</span>
                {future ? null : (
                  <span className="ship-tip" role="presentation">
                    <strong>{dayLabel(day.date)}</strong>
                    <span><i className="ship-key ship-key--commit" />{plural(day.commits, "commit")}</span>
                    {day.pullRequests.length > 0 ? (
                      <span><i className="ship-key ship-key--pr" />{plural(day.pullRequests.length, "pull request")}{merged > 0 ? ` · ${merged} merged` : ""}</span>
                    ) : null}
                    <span><i className="ship-key ship-key--spend" />{daySpend ? `${money(cost)} · ${plural(daySpend.sessions, "session")}` : "No AI sessions"}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
  );
}
