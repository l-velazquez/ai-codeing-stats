import { useEffect, useMemo, useState } from "react";
import type { DailyPoint } from "@shared/types";
import { scan } from "@renderer/lib/bridge";

export interface DayCost {
  readonly sessions: number;
  readonly cost: number;
}

/**
 * Daily AI cost for every recorded day, independent of the selected range.
 *
 * The Contributions page pairs each day's commits with what that day cost,
 * which is the one place the app connects spend to output. It used to read
 * `snapshot.daily`, which only covers the selected range: on the default 30-day
 * range an older month showed no correlation at all, and on 7d the chips
 * vanished from most of the current month. Scanning the full history once gives
 * the month view its own source. Main caches the parsed records, so this is
 * cheap after the first call.
 */
export function useDailyCostIndex(generatedAt: number | null): Map<string, DayCost> {
  const [daily, setDaily] = useState<DailyPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    void scan("all")
      .then((snapshot) => {
        if (!cancelled) setDaily(snapshot.daily);
      })
      .catch(() => {
        // The correlation chips are additive; losing them must not break the page.
      });
    return () => {
      cancelled = true;
    };
  }, [generatedAt]);

  return useMemo(() => {
    const map = new Map<string, DayCost>();
    for (const point of daily) map.set(point.date, { sessions: point.sessions, cost: point.cost });
    return map;
  }, [daily]);
}
