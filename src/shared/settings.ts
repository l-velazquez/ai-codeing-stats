import type { RangeKey } from "./types";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export interface WindowBounds {
  readonly width: number;
  readonly height: number;
  readonly x?: number;
  readonly y?: number;
}

export interface Settings {
  readonly version: 1;
  readonly theme: ThemePreference;
  readonly range: RangeKey;
  readonly subscriptionPollSeconds: number;
  readonly window: WindowBounds | null;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: "system",
  range: "30d",
  subscriptionPollSeconds: 15,
  window: null,
};

/**
 * The colour painted by the OS window before the renderer draws its first
 * frame. It must track the ground colour of each theme, or a light-theme
 * launch flashes dark.
 */
export const THEME_BACKGROUND: Record<ResolvedTheme, string> = {
  dark: "#0a0b0d",
  light: "#f5f6f7",
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
    range,
    subscriptionPollSeconds,
    window: normalizeWindow(raw.window),
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
