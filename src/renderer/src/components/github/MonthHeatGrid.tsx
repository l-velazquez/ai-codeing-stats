import type { CSSProperties } from "react";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { currentMonthKey } from "@shared/invoice";
import type { GitHubMonthSnapshot } from "@shared/types";

export function MonthHeatGrid({ data }: { data: GitHubMonthSnapshot }) {
  const peak = Math.max(1, ...data.days.map((day) => day.commits));
  const year = Number(data.month.slice(0, 4));
  const monthIndex = Number(data.month.slice(5, 7)) - 1;
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isCurrentMonth = data.month === currentMonthKey(today);
  return (
    <div className="panel gh-heat-panel">
      <CardTitle action={<span className="muted-label">{data.totals.activeDays} active days</span>}>Monthly rhythm</CardTitle>
      <div className="gh-weekdays" aria-hidden="true">{["S", "M", "T", "W", "T", "F", "S"].map((label, index) => <span key={index}>{label}</span>)}</div>
      <div className="gh-heat-grid">
        {Array.from({ length: firstWeekday }, (_, index) => <span key={`pad-${index}`} />)}
        {data.days.map((day) => {
          const future = isCurrentMonth && day.date > todayKey;
          return (
            <button
              key={day.date}
              className={`gh-heat-cell${day.date === todayKey ? " gh-heat-today" : ""}${future ? " gh-heat-future" : ""}`}
              title={future ? day.date : `${day.date}: ${day.commits} commits`}
              aria-label={future ? `${day.date}, no activity yet` : `${day.date}, ${day.commits} ${day.commits === 1 ? "commit" : "commits"}`}
              disabled={future}
              style={{ "--heat": Math.max(0.06, day.commits / peak) } as React.CSSProperties}
              onClick={() => document.getElementById(`gh-day-${day.date}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            />
          );
        })}
      </div>
      <div className="calendar-footer"><span>Click a day to jump to it</span><span aria-hidden="true">Less <i /><i /><i /><i /> More</span></div>
    </div>
  );
}
