import type { CSSProperties } from "react";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { money } from "@renderer/format";
import type { StatsSnapshot } from "@shared/types";

export function ActivityCalendar({ snapshot }: { snapshot: StatsSnapshot }) {
  const data = snapshot.daily.slice(-84);
  const peak = Math.max(0.01, ...data.map((day) => day.cost));
  return (
    <div className="calendar-card panel">
      <CardTitle action={<span className="muted-label">last {data.length} days</span>}>Coding rhythm</CardTitle>
      <div className="activity-grid">
        {data.map((day) => (
          <span
            key={day.date}
            title={`${day.date}: ${money(day.cost)} · ${day.sessions} sessions`}
            style={{ "--heat": Math.max(0.05, day.cost / peak) } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="calendar-footer"><span>{snapshot.summary.activeDays} active days</span><span>Less <i /><i /><i /><i /> More</span></div>
    </div>
  );
}
