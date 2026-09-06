import { useCallback, useEffect, useRef, useState } from "react";
import { readSettings, writeSettings } from "@renderer/lib/bridge";

/**
 * Sidebar visibility, persisted like the theme is. The argv hint gives the
 * correct state on the first paint; the stored preference is still the source
 * of truth, and covers dev:web, which has no bridge to hint with.
 */
export function useSidebar(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState(
    () => window.tokenary?.initial.sidebarCollapsed ?? false,
  );
  const toggled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void readSettings()
      .then((settings) => {
        // A toggle that beat the read home is the newer intent; do not undo it.
        if (!cancelled && !toggled.current) setCollapsed(settings.sidebarCollapsed);
      })
      .catch(() => {
        // Keep whatever the pre-paint hint gave us.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toggled.current) return;
    void writeSettings({ sidebarCollapsed: collapsed }).catch(() => {
      // The in-memory state still applies for this session.
    });
  }, [collapsed]);

  const toggle = useCallback(() => {
    toggled.current = true;
    setCollapsed((current) => !current);
  }, []);

  return { collapsed, toggle };
}
