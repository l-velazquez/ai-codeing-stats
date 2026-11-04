import { useCallback, useEffect, useRef, useState } from "react";
import type { RangeKey } from "@shared/types";
import { readSettings, writeSettings } from "@renderer/lib/bridge";

/** Restore the range without letting a late settings read undo a new choice. */
export function useRange(): { range: RangeKey; setRange: (range: RangeKey) => void } {
  const [range, updateRange] = useState<RangeKey>(() => window.azulCode?.initial.range ?? "30d");
  const changed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void readSettings().then((settings) => {
      if (!cancelled && !changed.current) updateRange(settings.range);
    }).catch(() => {
      // Keep the launch hint or default when preferences cannot be read.
    });
    const unsubscribe = window.azulCode?.onSettingsChanged((settings) => {
      changed.current = true;
      updateRange(settings.range);
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, []);

  const setRange = useCallback((next: RangeKey) => {
    changed.current = true;
    updateRange(next);
    void writeSettings({ range: next }).catch(() => {
      // The selected range still applies for this session.
    });
  }, []);

  return { range, setRange };
}
