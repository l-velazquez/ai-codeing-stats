import { useCallback, useEffect, useRef, useState } from "react";
import type { GitHubMonthSnapshot } from "@shared/types";
import { currentMonthKey, shiftMonthKey } from "@shared/invoice";
import { fetchGithubMonth } from "@renderer/lib/bridge";

export interface GithubMonthState {
  readonly month: string;
  readonly currentMonth: string;
  readonly data: GitHubMonthSnapshot | null;
  /** True when `data` belongs to a different month than `month`. */
  readonly stale: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly step: (delta: number) => void;
  readonly reload: () => void;
}

/**
 * Stale-while-revalidate. The page previously derived its view as
 * `data.month === month ? data : null`, so every month arrow blanked the whole
 * page -- KPIs, day cards and heat grid all unmounted and remounted behind a
 * loading panel. Keeping the previous month rendered while the next one loads
 * removes that jump; `stale` lets the UI dim rather than disappear.
 */
export function useGithubMonth(): GithubMonthState {
  const currentMonth = currentMonthKey();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<GitHubMonthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (target: string, refresh = false) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchGithubMonth(target, refresh);
      if (id !== requestId.current) return;
      setData(next);
    } catch (reason) {
      if (id !== requestId.current) return;
      setError(reason instanceof Error ? reason.message : "GitHub activity could not be loaded.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(month);
  }, [load, month]);

  const step = useCallback(
    (delta: number) => {
      setMonth((current) => {
        const next = shiftMonthKey(current, delta);
        return next > currentMonth ? current : next;
      });
    },
    [currentMonth],
  );

  const reload = useCallback(() => void load(month, true), [load, month]);

  return {
    month,
    currentMonth,
    data,
    stale: data !== null && data.month !== month,
    loading,
    error,
    step,
    reload,
  };
}
