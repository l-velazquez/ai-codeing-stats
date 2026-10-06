import type { ResolvedTheme, ThemePreference } from "../../../shared/types";

import { customAccentVars, type AccentColor, type CustomAccentVars } from "../../../shared/settings";

const CUSTOM_PROPS: readonly (keyof CustomAccentVars)[] = [
  "--accent", "--accent-light", "--accent-solid", "--brand-start", "--brand-end",
];

export function applyAccent(accent: AccentColor, customAccent?: string, resolved: ResolvedTheme = "dark"): void {
  const root = document.documentElement;
  root.dataset.accent = accent;
  for (const prop of CUSTOM_PROPS) root.style.removeProperty(prop);
  if (accent !== "custom") return;
  const vars = customAccentVars(customAccent);
  // In light theme --accent must come from --accent-light through the
  // stylesheet rule, so an inline --accent would override it. Dark needs the
  // inline value because there is no equivalent rule.
  for (const prop of CUSTOM_PROPS) {
    if (prop === "--accent" && resolved === "light") continue;
    root.style.setProperty(prop, vars[prop]);
  }
}

/**
 * Keeps the accent mirrored for dev:web, which has no preload bridge and so
 * no argv hint: its pre-paint script in index.html reads this back. The demo
 * settings store owns this key, so the mirror merges rather than replaces —
 * and carries the derived roles, since the pre-paint script cannot run the
 * derivation itself.
 */
export function mirrorAccent(accent: AccentColor, customAccent: string): void {
  try {
    const raw = JSON.parse(localStorage.getItem("azul-code:settings") ?? "{}");
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("not a settings object");
    raw.accent = accent;
    raw.customAccent = customAccent;
    raw.roles = accent === "custom" ? customAccentVars(customAccent) : null;
    localStorage.setItem("azul-code:settings", JSON.stringify(raw));
  } catch {
    // Storage can be unavailable; the in-memory preference still applies.
  }
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia(DARK_QUERY).matches;
}

export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

/**
 * Mirrors the preference so dev:web (which has no preload bridge and so no
 * settings.json) still themes correctly before its first paint.
 */
export function mirrorPreference(preference: ThemePreference, resolved: ResolvedTheme): void {
  try {
    localStorage.setItem("azul-code:theme", preference === "system" ? resolved : preference);
  } catch {
    // Storage can be unavailable; the in-memory preference still applies.
  }
}

export function watchSystemTheme(onChange: (prefersDark: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export const THEME_LABELS: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

export const THEME_ORDER: readonly ThemePreference[] = ["dark", "light", "system"];

export function nextTheme(current: ThemePreference): ThemePreference {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length] ?? "system";
}
