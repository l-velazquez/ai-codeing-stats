import type { Provider, TokenTotals } from "../../shared/types";

export const PROVIDERS: Record<
  Provider,
  { label: string; color: string; tint: string }
> = {
  // CSS variables rather than literals so the boring theme can grey them out.
  codex: { label: "Codex", color: "var(--provider-codex)", tint: "var(--provider-codex-tint)" },
  claude: { label: "Claude Code", color: "var(--provider-claude)", tint: "var(--provider-claude-tint)" },
  opencode: { label: "OpenCode", color: "var(--provider-opencode)", tint: "var(--provider-opencode-tint)" },
};

export function money(value: number, precise = false): string {
  if (value > 0 && value < 0.01) return "<$0.01";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: precise ? 4 : 2,
    maximumFractionDigits: precise ? 4 : 2,
  }).format(value);
}

export function compact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
  }).format(value);
}

export function percent(value: number): string {
  return `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`;
}

export function shortDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(timestamp);
}

export function dateTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

/**
 * A wall-clock time, with the weekday added once the moment is not today --
 * "resets 4:10 PM" is unambiguous, "resets 4:10 PM" three days out is not.
 */
export function clockTime(timestamp: number, now = Date.now()): string {
  const sameDay = localDayKey(new Date(timestamp)) === localDayKey(new Date(now));
  return new Intl.DateTimeFormat(
    "en-US",
    sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { weekday: "short", hour: "numeric", minute: "2-digit" },
  ).format(timestamp);
}

export function relative(timestamp: number, now = Date.now()): string {
  const elapsed = now - timestamp;
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return shortDate(timestamp);
}

/** "just now", "5m ago", or "on Oct 3" once relative() falls back to a date. */
export function ago(timestamp: number, now = Date.now()): string {
  const elapsed = relative(timestamp, now);
  if (elapsed === "now") return "just now";
  return /^\d+[mhd]$/.test(elapsed) ? `${elapsed} ago` : `on ${elapsed}`;
}

export function duration(start: number, end: number): string {
  const totalMinutes = Math.max(1, Math.round((end - start) / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function modelName(model: string): string {
  const id = model.includes("/") ? model.split("/").at(-1) ?? model : model;
  return id
    .replace(/^claude-/, "Claude ")
    .replace(/^gpt-/, "GPT ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function cacheRate(tokens: TokenTotals): number {
  const input =
    tokens.uncachedInput + tokens.cachedInput + tokens.cacheWrite5m + tokens.cacheWrite1h;
  return input === 0 ? 0 : tokens.cachedInput / input;
}

/**
 * Today as "YYYY-MM-DD" in local time. The scanner buckets days locally, so
 * using toISOString here would disagree with it for several hours a day.
 */
export function localDayKey(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
