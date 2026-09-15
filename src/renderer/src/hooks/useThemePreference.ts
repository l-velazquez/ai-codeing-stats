import { useCallback, useEffect, useState } from "react";
import { resolveTheme, type AccentColor, type ThemePreference } from "@shared/settings";
import { readSettings, writeSettings } from "@renderer/lib/bridge";
import { applyAccent, applyTheme, mirrorPreference, systemPrefersDark, watchSystemTheme } from "@renderer/lib/theme";

export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemePreference>(
    () => window.azulCode?.initial.theme ?? "system",
  );
  const [accent, setAccentState] = useState<AccentColor>(() => window.azulCode?.initial.accent ?? "blue");
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  // The stored preference is the source of truth; the argv hint only covers the
  // first paint.
  useEffect(() => {
    let cancelled = false;
    void readSettings()
      .then((settings) => {
        if (!cancelled) { setThemeState(settings.theme); setAccentState(settings.accent); }
      })
      .catch(() => {
        // Keep whatever the pre-paint hint gave us.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => watchSystemTheme(setPrefersDark), []);
  useEffect(() => window.azulCode?.onSettingsChanged((settings) => { setThemeState(settings.theme); setAccentState(settings.accent); }), []);

  const resolved = resolveTheme(theme, prefersDark);

  useEffect(() => {
    applyTheme(resolved);
    mirrorPreference(theme, resolved);
  }, [theme, resolved]);

  useEffect(() => { applyAccent(accent); }, [accent]);

  const setAccent = useCallback((next: AccentColor) => {
    setAccentState(next);
    void writeSettings({ accent: next }).catch(() => {});
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    void writeSettings({ theme: next }).catch(() => {
      // The in-memory preference still applies for this session.
    });
  }, []);

  return { theme, setTheme, accent, setAccent };
}
