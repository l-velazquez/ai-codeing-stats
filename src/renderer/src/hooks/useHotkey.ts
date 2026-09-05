import { useEffect } from "react";

/**
 * Renderer-level shortcut. Deliberately not a native menu item: the app defines
 * no custom Menu, and adding one purely for Preferences would need a new push
 * channel for no user-visible gain.
 */
export function useHotkey(key: string, handler: () => void, { meta = true } = {}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== key) return;
      if (meta && !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, handler, meta]);
}
