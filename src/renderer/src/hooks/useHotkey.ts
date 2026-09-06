import { useEffect } from "react";
import { IS_MAC } from "@renderer/lib/platform";

/**
 * Renderer-level shortcut. Deliberately not a native menu item: the app defines
 * no custom Menu, and adding one purely for Preferences would need a new push
 * channel for no user-visible gain.
 *
 * The modifier follows the platform -- Command on macOS, Control on Windows and
 * Linux -- so Control+B keeps meaning "back one character" in a macOS text field.
 */
export function useHotkey(key: string, handler: () => void, { meta = true } = {}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Held keys repeat; a toggle bound to one would strobe.
      if (event.repeat) return;
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (meta && !(IS_MAC ? event.metaKey : event.ctrlKey)) return;
      event.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, handler, meta]);
}
