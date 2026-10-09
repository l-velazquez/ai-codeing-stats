import { useCallback, useEffect, useState } from "react";
import { readSettings, writeSettings } from "@renderer/lib/bridge";

/**
 * Projects left out of copied invoice summaries, persisted so personal repos
 * stay unticked from one month to the next.
 */
export function useInvoiceExclusions(): { excluded: ReadonlySet<string>; setExcluded: (repos: Iterable<string>) => void } {
  const [excluded, setExcludedState] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void readSettings()
      .then((settings) => {
        if (!cancelled) setExcludedState(new Set(settings.invoiceExcludedRepos));
      })
      .catch(() => {
        // Nothing excluded is a safe default: the user sees every project ticked.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => window.azulCode?.onSettingsChanged((settings) => setExcludedState(new Set(settings.invoiceExcludedRepos))),
    [],
  );

  const setExcluded = useCallback((repos: Iterable<string>) => {
    const next = new Set(repos);
    setExcludedState(next);
    void writeSettings({ invoiceExcludedRepos: [...next] }).catch(() => {
      // The selection still applies for this session.
    });
  }, []);

  return { excluded, setExcluded };
}
