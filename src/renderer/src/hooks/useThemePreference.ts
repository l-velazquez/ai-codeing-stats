import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeHexColor, resolveTheme, type AccentColor, type ThemePreference } from "@shared/settings";
import { readSettings, writeSettings } from "@renderer/lib/bridge";
import { readDemoSettings } from "@renderer/lib/demoSettings";
import { applyAccent, applyTheme, mirrorAccent, mirrorPreference, systemPrefersDark, watchSystemTheme } from "@renderer/lib/theme";

export function useThemePreference() {
  // dev:web has no bridge, so its initial hint comes from the demo settings
  // store — the same place the pre-paint script reads. Electron short-circuits
  // to the argv values, which mirror settings.json.
  const [theme, setThemeState] = useState<ThemePreference>(
    () => window.azulCode?.initial.theme ?? "system",
  );
  const [accent, setAccentState] = useState<AccentColor>(
    () => window.azulCode?.initial.accent ?? readDemoSettings().accent,
  );
  const [customAccent, setCustomAccentState] = useState<string>(
    () => normalizeHexColor(window.azulCode?.initial.customAccent ?? readDemoSettings().customAccent),
  );
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
  // Dragging the picker fires dozens of writes a second; only the last one
  // reaches disk, while every intermediate value still recolours the page.
  const pendingAccentWrite = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The stored preference is the source of truth; the argv hint only covers the
  // first paint.
  useEffect(() => {
    let cancelled = false;
    void readSettings()
      .then((settings) => {
        if (!cancelled) { setThemeState(settings.theme); setAccentState(settings.accent); setCustomAccentState(settings.customAccent); }
      })
      .catch(() => {
        // Keep whatever the pre-paint hint gave us.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => watchSystemTheme(setPrefersDark), []);
  useEffect(() => window.azulCode?.onSettingsChanged((settings) => { setThemeState(settings.theme); setAccentState(settings.accent); setCustomAccentState(settings.customAccent); }), []);

  const resolved = resolveTheme(theme, prefersDark);

  useEffect(() => {
    applyTheme(resolved);
    mirrorPreference(theme, resolved);
  }, [theme, resolved]);

  useEffect(() => {
    applyAccent(accent, customAccent, resolved);
    mirrorAccent(accent, customAccent);
  }, [accent, customAccent, resolved]);

  const cancelPendingCustomWrite = useCallback(() => {
    if (pendingAccentWrite.current !== null) {
      clearTimeout(pendingAccentWrite.current);
      pendingAccentWrite.current = null;
    }
  }, []);

  const setAccent = useCallback((next: AccentColor) => {
    cancelPendingCustomWrite();
    setAccentState(next);
    void writeSettings({ accent: next }).catch(() => {});
  }, [cancelPendingCustomWrite]);

  const setCustomAccent = useCallback((next: string) => {
    const hex = normalizeHexColor(next);
    setCustomAccentState(hex);
    if (pendingAccentWrite.current !== null) clearTimeout(pendingAccentWrite.current);
    pendingAccentWrite.current = setTimeout(() => {
      pendingAccentWrite.current = null;
      void writeSettings({ accent: "custom", customAccent: hex }).catch(() => {});
    }, 250);
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    void writeSettings({ theme: next }).catch(() => {
      // The in-memory preference still applies for this session.
    });
  }, []);

  return { theme, setTheme, accent, setAccent, customAccent, setCustomAccent };
}
