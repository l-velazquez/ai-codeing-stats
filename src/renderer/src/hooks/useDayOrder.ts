import { useCallback, useEffect, useState } from "react";
import type { DayOrder } from "@shared/settings";
import { readSettings, writeSettings } from "@renderer/lib/bridge";

/**
 * Direction of the Contributions day ledger, persisted like the theme is.
 * There is no argv hint for this one -- Contributions is never the first paint,
 * so the stored value always lands before the page is reachable.
 */
export function useDayOrder(): { order: DayOrder; toggle: () => void } {
  const [order, setOrder] = useState<DayOrder>("oldest");

  useEffect(() => {
    let cancelled = false;
    void readSettings()
      .then((settings) => {
        if (!cancelled) setOrder(settings.contributionsOrder);
      })
      .catch(() => {
        // Keep the default; the session still works without a stored value.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => window.tally?.onSettingsChanged((settings) => setOrder(settings.contributionsOrder)),
    [],
  );

  const toggle = useCallback(() => {
    const next: DayOrder = order === "newest" ? "oldest" : "newest";
    setOrder(next);
    void writeSettings({ contributionsOrder: next }).catch(() => {
      // The in-memory preference still applies for this session.
    });
  }, [order]);

  return { order, toggle };
}
