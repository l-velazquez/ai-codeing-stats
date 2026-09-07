import type { Settings } from "./settings";
import type { ProviderStat, SourceStatus, StatsSnapshot, SubscriptionUsage, SubscriptionWindow } from "./types";

export interface MenuBarSummary {
  readonly day: string;
  readonly updatedAt: number;
  readonly cost: number;
  readonly tokens: number;
  readonly pricedPercent: number;
  readonly providers: ProviderStat[];
  readonly sources: SourceStatus[];
  readonly subscriptions: SubscriptionUsage[];
}

export interface MenuBarState {
  readonly summary: MenuBarSummary | null;
  readonly refreshing: boolean;
  readonly error: string | null;
}

export function localDayKey(now = Date.now()): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Input must be aggregated from records since local midnight, not session totals. */
export function menuBarSummary(today: StatsSnapshot): MenuBarSummary {
  return {
    day: localDayKey(today.generatedAt), updatedAt: today.generatedAt,
    cost: today.summary.cost, tokens: today.summary.totalTokens,
    pricedPercent: today.summary.pricedPercent, providers: today.providers,
    sources: today.sources, subscriptions: today.subscriptions,
  };
}

export function selectedAllowance(summary: MenuBarSummary | null, settings: Settings): SubscriptionWindow | null {
  const usage = summary?.subscriptions.find((item) => item.provider === settings.menuBarProvider);
  if (usage?.state !== "live") return null;
  return usage.windows.find((window) => settings.menuBarWindow === "weekly"
    ? window.windowMinutes >= 10_080 : window.windowMinutes > 0 && window.windowMinutes < 1_440) ?? null;
}

export function remainingPercent(window: SubscriptionWindow): number {
  return Math.round(Math.max(0, Math.min(100, 100 - window.usedPercent)));
}

export function allowanceIsStale(usage: SubscriptionUsage, window: SubscriptionWindow, now = Date.now()): boolean {
  return window.resetsAt <= now || usage.updatedAt === null || now - usage.updatedAt > 15 * 60_000;
}

export function menuBarTitle(state: MenuBarState, settings: Settings, now = Date.now()): string {
  if (settings.menuBarDisplay === "icon") return "";
  const summary = state.summary;
  const current = summary?.day === localDayKey(now);
  const available = summary?.sources.some((source) => source.state === "connected");
  const partial = !!summary && (summary.pricedPercent < 1 || summary.sources.some((source) => source.state === "error"));
  const stale = !!state.error || (!!summary && now - summary.updatedAt > 120_000);
  const amount = summary && current && available
    ? `${summary.cost > 0 && summary.cost < 0.01 ? "<$0.01" : new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", notation: summary.cost >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: summary.cost >= 10_000 ? 1 : 2,
      minimumFractionDigits: summary.cost >= 10_000 ? 0 : 2,
    }).format(summary.cost)}${partial || stale ? "*" : ""}` : "—";
  const window = selectedAllowance(summary, settings);
  const usage = summary?.subscriptions.find((item) => item.provider === settings.menuBarProvider);
  const period = window ? (window.windowMinutes >= 1_440 ? `${Math.round(window.windowMinutes / 1_440)}d` : `${Math.round(window.windowMinutes / 60)}h`)
    : settings.menuBarWindow === "weekly" ? "7d" : "short";
  const label = `${settings.menuBarProvider === "codex" ? "Cx" : "Cl"} ${period}`;
  const allowance = `${label} ${window && usage && !allowanceIsStale(usage, window, now) && !stale ? `${remainingPercent(window)}%` : "—"}`;
  if (settings.menuBarDisplay === "allowance") return allowance;
  if (settings.menuBarDisplay === "both") return `${amount} · ${allowance}`;
  return amount;
}
