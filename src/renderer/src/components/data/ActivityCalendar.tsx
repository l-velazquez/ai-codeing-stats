import type { CSSProperties } from "react";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { money } from "@renderer/format";
import type { StatsSnapshot } from "@shared/types";

export function ActivityCalendar({ snapshot }: { snapshot: StatsSnapshot }) {
  const data = snapshot.daily.slice(-84);
  const peak = Math.max(0.01, ...data.map((day) => day.cost));
  const busiest = data.reduce<(typeof data)[number] | null>(
    (best, day) => (best === null || day.cost > best.cost ? day : best),
    null,
  );

  return (
    <div className="calendar-card panel">
      <CardTitle action={<span className="muted-label">last {data.length} days</span>}>Coding rhythm</CardTitle>

      {/* The grid is decorative for assistive tech -- 84 individually announced
          cells is noise -- so the same information is summarised in one line
          that screen readers get and sighted users do not need. */}
      <div className="activity-grid" role="presentation">
        {data.map((day) => (
          <span
            key={day.date}
            title={`${day.date}: ${money(day.cost)} · ${day.sessions} sessions`}
            style={{ "--heat": Math.max(0.05, day.cost / peak) } as CSSProperties}
          />
        ))}
      </div>

      <p className="visually-hidden">
        {data.length} days shown, {snapshot.summary.activeDays} of them active.
        {busiest ? ` Busiest day ${busiest.date} at ${money(busiest.cost)}.` : ""}
      </p>

      <div className="calendar-footer">
        <span>{snapshot.summary.activeDays} active days</span>
        <span aria-hidden="true">Less <i /><i /><i /><i /> More</span>
      </div>
    </div>
  );
}
