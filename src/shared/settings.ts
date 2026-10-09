import type { RangeKey } from "./types";

export type ThemePreference = "dark" | "light" | "system";
export const ACCENT_COLORS = ["red", "orange", "green", "blue", "pink", "violet"] as const;
export type PresetAccent = typeof ACCENT_COLORS[number];
/** Every preset name plus "custom", which drives the theme from a picked hex. */
export type AccentColor = PresetAccent | "custom";
export function normalizeAccent(value: unknown): AccentColor {
  if (value === "custom") return "custom";
  return ACCENT_COLORS.includes(value as PresetAccent) ? value as PresetAccent : "blue";
}

/** The accent a fresh install starts on when Custom is first selected. */
export const CUSTOM_ACCENT_DEFAULT = "#00c8ff";

/**
 * Accepts #rgb, #rrggbb, with or without the hash, and anything else falls
 * back. Like normalizeSettings this never throws: a hand-edited settings file
 * must not stop the app booting.
 */
export function normalizeHexColor(value: unknown, fallback: string = CUSTOM_ACCENT_DEFAULT): string {
  if (typeof value !== "string") return fallback;
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value.trim());
  if (!match) return fallback;
  const hex = match[1];
  return `#${(hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex).toLowerCase()}`;
}

/** The CSS custom properties a custom accent must set to recolour the page. */
export type CustomAccentVars =
  & Record<"--accent" | "--accent-light" | "--accent-solid" | "--brand-start" | "--brand-end", string>;

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const [r, g, b] = channels(hex).map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta + 6) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${rgb.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Derives the accent roles from any colour the user picks. Every preset keeps
 * two readable values per theme: a light, saturated highlight for the dark
 * theme and a darker one for text on white. The picker respects the picked
 * hue and chroma but pulls each role into the same bands the presets occupy,
 * so a near-black maroon or a pastel still produce a usable theme. Near-greys
 * stay grey rather than being saturated into a colour the user never chose.
 */
export function customAccentVars(hex: unknown): CustomAccentVars {
  const { h, s, v } = hexToHsv(normalizeHexColor(hex));
  const chroma = s >= 0.1;
  const sat = (floor: number) => (chroma ? Math.max(s, floor) : s);
  return {
    "--accent": hsvToHex(h, sat(0.6), clamp(v, 0.88, 1)),
    "--accent-light": hsvToHex(h, sat(0.55), clamp(v, 0.42, 0.78)),
    "--accent-solid": hsvToHex(h, sat(0.55), clamp(v, 0.78, 0.95)),
    "--brand-start": hsvToHex(h, sat(0.75), 1),
    "--brand-end": hsvToHex(h, sat(0.8), clamp(v * 0.72, 0.48, 0.72)),
  };
}

/** The solid accent behind a theme ground, custom included. */
export function accentSolidHex(accent: AccentColor, customAccent?: string): string {
  return accent === "custom" ? normalizeHexColor(customAccent) : ACCENT_SOLID[accent];
}

export type ResolvedTheme = "dark" | "light";
export type MenuBarDisplay = "cost" | "allowance" | "both" | "icon";
/** Direction of the Contributions day ledger. The month walk emits days oldest-first. */
export type DayOrder = "oldest" | "newest";

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
  /** Only used when accent is "custom"; always a normalized #rrggbb string. */
  readonly customAccent: string;
  readonly range: RangeKey;
  readonly subscriptionPollSeconds: number;
  readonly window: WindowBounds | null;
  /** Sidebar visibility survives a relaunch: a pane the user hid stays hidden. */
  readonly sidebarCollapsed: boolean;
  readonly menuBarEnabled: boolean;
  readonly menuBarDisplay: MenuBarDisplay;
  readonly menuBarProvider: "codex" | "claude";
  readonly menuBarWindow: "session" | "weekly";
  readonly contributionsOrder: DayOrder;
  /**
   * Repositories left out of copied invoice summaries, as owner/name. Stored as
   * exclusions so a newly active project is included until it is unticked.
   */
  readonly invoiceExcludedRepos: readonly string[];
  /** Keeps model prices current from models.dev; off means the bundled table only. */
  readonly livePricing: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: "system",
  accent: "blue",
  customAccent: CUSTOM_ACCENT_DEFAULT,
  range: "30d",
  subscriptionPollSeconds: 15,
  window: null,
  sidebarCollapsed: false,
  menuBarEnabled: true,
  menuBarDisplay: "cost",
  menuBarProvider: "codex",
  menuBarWindow: "session",
  contributionsOrder: "oldest",
  invoiceExcludedRepos: [],
  livePricing: true,
};

/**
 * The untinted ground of each theme -- --bg-base in tokens.css.
 */
export const THEME_BACKGROUND: Record<ResolvedTheme, string> = {
  dark: "#05080c",
  light: "#eff3f7",
};

/** --accent-solid per accent, mirrored from tokens.css. */
export const ACCENT_SOLID: Record<PresetAccent, string> = {
  red: "#e8103a",
  orange: "#c8550c",
  green: "#16864d",
  blue: "#2460ff",
  pink: "#c92b82",
  violet: "#7c3de0",
};

/** The share of the accent mixed into --bg by tokens.css. */
const BACKGROUND_ACCENT_MIX = 0.07;

function mixChannel(base: number, accent: number): number {
  return Math.round(base * (1 - BACKGROUND_ACCENT_MIX) + accent * BACKGROUND_ACCENT_MIX);
}

function channels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * The colour painted by the OS window before the renderer draws its first
 * frame. It must track the ground colour of the current theme *and* accent, or
 * a launch flashes the wrong colour: `color-mix(in srgb, ...)` interpolates in
 * gamma-encoded sRGB, so the same per-channel blend reproduces --bg exactly.
 */
export function themeBackground(theme: ResolvedTheme, accent: AccentColor, customAccent?: string): string {
  const base = channels(THEME_BACKGROUND[theme]);
  const tint = channels(accentSolidHex(accent, customAccent));
  return `#${base
    .map((value, index) => mixChannel(value, tint[index] ?? 0).toString(16).padStart(2, "0"))
    .join("")}`;
}

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
    customAccent: normalizeHexColor(raw.customAccent),
    range,
    subscriptionPollSeconds,
    window: normalizeWindow(raw.window),
    menuBarEnabled: typeof raw.menuBarEnabled === "boolean" ? raw.menuBarEnabled : DEFAULT_SETTINGS.menuBarEnabled,
    menuBarDisplay: ["cost", "allowance", "both", "icon"].includes(raw.menuBarDisplay as string)
      ? raw.menuBarDisplay as MenuBarDisplay : DEFAULT_SETTINGS.menuBarDisplay,
    menuBarProvider: raw.menuBarProvider === "claude" ? "claude" : "codex",
    menuBarWindow: raw.menuBarWindow === "weekly" ? "weekly" : "session",
    contributionsOrder: raw.contributionsOrder === "newest" ? "newest" : "oldest",
    invoiceExcludedRepos: Array.isArray(raw.invoiceExcludedRepos)
      ? [...new Set(raw.invoiceExcludedRepos.filter((repo): repo is string => typeof repo === "string" && repo.length > 0 && repo.length <= 200))].slice(0, 500)
      : DEFAULT_SETTINGS.invoiceExcludedRepos,
    livePricing: typeof raw.livePricing === "boolean" ? raw.livePricing : DEFAULT_SETTINGS.livePricing,
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
