import { useEffect, useState } from "react";
import type { GitHubDay } from "@shared/types";
import { currentMonthKey, shiftMonthKey } from "@shared/invoice";
import { localDayKey } from "@renderer/format";
import { fetchGithubMonth } from "@renderer/lib/bridge";

export interface RecentGithubDays {
  readonly state: "loading" | "ok" | "setup" | "error";
  /** Oldest first, ending today. Empty unless `state` is "ok". */
  readonly days: GitHubDay[];
}

/**
 * The last `count` days of GitHub activity, wherever the month boundary falls.
 *
 * Overview used to read the Contributions page's month, which is whatever
 * month that page was last left on -- step back to August and the home
 * screen's "today" card went blank. This reads the current month (and the one
 * before, when the window reaches into it) on its own. Main caches each month,
 * so this shares work with Contributions rather than repeating it.
 */
export function useRecentGithubDays(count: number, refreshKey: unknown): RecentGithubDays {
  const [result, setResult] = useState<RecentGithubDays>({ state: "loading", days: [] });

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1));
    const startKey = localDayKey(start);
    const todayKey = localDayKey(now);
    const current = currentMonthKey(now);
    const months = currentMonthKey(start) === current ? [current] : [shiftMonthKey(current, -1), current];
    void Promise.all(months.map((month) => fetchGithubMonth(month)))
      .then((snapshots) => {
        if (cancelled) return;
        if (snapshots.some((snapshot) => snapshot.state === "setup")) {
          setResult({ state: "setup", days: [] });
          return;
        }
        const days = snapshots.flatMap((snapshot) => snapshot.days).filter((day) => day.date >= startKey && day.date <= todayKey);
        setResult({ state: "ok", days });
      })
      .catch(() => {
        if (!cancelled) setResult({ state: "error", days: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [count, refreshKey]);

  return result;
}
