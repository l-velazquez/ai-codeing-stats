import type { Provider, TokenTotals } from "../../shared/types";

export const PROVIDERS: Record<
  Provider,
  { label: string; color: string; tint: string }
> = {
  codex: { label: "Codex", color: "#dce1e7", tint: "rgba(220,225,231,.1)" },
  claude: { label: "Claude Code", color: "#d97757", tint: "rgba(217,119,87,.12)" },
  opencode: { label: "OpenCode", color: "#78bdf8", tint: "rgba(120,189,248,.12)" },
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

export function relative(timestamp: number): string {
  const elapsed = Date.now() - timestamp;
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return shortDate(timestamp);
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
