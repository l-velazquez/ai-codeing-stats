import type { RangeKey } from "./types";

export type ThemePreference = "dark" | "light" | "system";
export const ACCENT_COLORS = ["red", "orange", "green", "blue", "pink", "violet"] as const;
export type AccentColor = typeof ACCENT_COLORS[number];
export function normalizeAccent(value: unknown): AccentColor {
  return ACCENT_COLORS.includes(value as AccentColor) ? value as AccentColor : "blue";
}

export type ResolvedTheme = "dark" | "light";
export type MenuBarDisplay = "cost" | "allowance" | "both" | "icon";

export interface WindowBounds {
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
}

export interface Settings {
  readonly version: 1;
  readonly theme: ThemePreference;
  readonly accent: AccentColor;
  readonly range: RangeKey;
  readonly subscriptionPollSeconds: number;
  readonly window: WindowBounds | null;
  /** Sidebar visibility survives a relaunch: a pane the user hid stays hidden. */
  readonly sidebarCollapsed: boolean;
  readonly menuBarEnabled: boolean;
  readonly menuBarDisplay: MenuBarDisplay;
  readonly menuBarProvider: "codex" | "claude";
  readonly menuBarWindow: "session" | "weekly";
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: "system",
  accent: "blue",
  range: "30d",
  subscriptionPollSeconds: 15,
  window: null,
  sidebarCollapsed: false,
  menuBarEnabled: true,
  menuBarDisplay: "cost",
  menuBarProvider: "codex",
  menuBarWindow: "session",
};

/**
 * The colour painted by the OS window before the renderer draws its first
 * frame. It must track the ground colour of each theme, or a light-theme
 * launch flashes dark.
 */
export const THEME_BACKGROUND: Record<ResolvedTheme, string> = {
  dark: "#070b10",
  light: "#eff3f7",
};

const THEME_PREFERENCES: readonly ThemePreference[] = ["dark", "light", "system"];
const RANGES: readonly RangeKey[] = ["7d", "30d", "90d", "all"];

const MIN_POLL_SECONDS = 5;
const MAX_POLL_SECONDS = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finitePositive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeWindow(value: unknown): WindowBounds | null {
  if (!isRecord(value)) return null;
  const width = finitePositive(value.width);
  const height = finitePositive(value.height);
  if (width === null || height === null) return null;
  const x = typeof value.x === "number" && Number.isFinite(value.x) ? value.x : undefined;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? value.y : undefined;
  return { width: Math.round(width), height: Math.round(height), ...(x === undefined ? {} : { x: Math.round(x) }), ...(y === undefined ? {} : { y: Math.round(y) }) };
}

/**
 * Total: never throws, whatever is on disk. A corrupt or hand-edited
 * settings file must degrade to defaults rather than prevent the app booting.
 */
export function normalizeSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;

  const theme = THEME_PREFERENCES.includes(raw.theme as ThemePreference)
    ? (raw.theme as ThemePreference)
    : DEFAULT_SETTINGS.theme;

  const range = RANGES.includes(raw.range as RangeKey)
    ? (raw.range as RangeKey)
    : DEFAULT_SETTINGS.range;

  const rawPoll = finitePositive(raw.subscriptionPollSeconds);
  const subscriptionPollSeconds =
    rawPoll === null
      ? DEFAULT_SETTINGS.subscriptionPollSeconds
      : Math.min(MAX_POLL_SECONDS, Math.max(MIN_POLL_SECONDS, Math.round(rawPoll)));

  return {
    version: 1,
    theme,
    accent: normalizeAccent(raw.accent),
    range,
    subscriptionPollSeconds,
    window: normalizeWindow(raw.window),
    menuBarEnabled: typeof raw.menuBarEnabled === "boolean" ? raw.menuBarEnabled : DEFAULT_SETTINGS.menuBarEnabled,
    menuBarDisplay: ["cost", "allowance", "both", "icon"].includes(raw.menuBarDisplay as string)
      ? raw.menuBarDisplay as MenuBarDisplay : DEFAULT_SETTINGS.menuBarDisplay,
    menuBarProvider: raw.menuBarProvider === "claude" ? "claude" : "codex",
    menuBarWindow: raw.menuBarWindow === "weekly" ? "weekly" : "session",
    sidebarCollapsed:
      typeof raw.sidebarCollapsed === "boolean"
        ? raw.sidebarCollapsed
        : DEFAULT_SETTINGS.sidebarCollapsed,
  };
}

/**
 * Takes the media state as an argument rather than reading matchMedia itself.
 * Electron's nativeTheme.themeSource changes what prefers-color-scheme reports
 * inside the renderer, so a function that read the media query internally could
 * be tested green while the running app disagreed.
 */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}
