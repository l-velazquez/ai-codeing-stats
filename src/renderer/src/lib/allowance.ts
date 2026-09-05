import type { SubscriptionUsage, SubscriptionWindow } from "@shared/types";

/** Human countdown to a window reset. */
export function resetText(timestamp: number): string {
  const remaining = timestamp - Date.now();
  if (remaining <= 0) return "Reset due";
  const totalMinutes = Math.ceil(remaining / 60_000);
  if (totalMinutes < 60) return `Resets in ${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return `Resets in ${hours}h${minutes ? ` ${minutes}m` : ""}`;
  const days = Math.floor(hours / 24);
  return `Resets in ${days}d ${hours % 24}h`;
}

/** True when a provider is actually reporting allowance, not just activity. */
export function isLive(usage: SubscriptionUsage): boolean {
  return usage.state === "live" && usage.windows.length > 0;
}

/**
 * The window closest to its limit, which is the one worth leading with: it is
 * the first thing that will stop you working.
 */
export function worstWindow(usage: SubscriptionUsage): SubscriptionWindow | null {
  if (!isLive(usage)) return null;
  return usage.windows.reduce<SubscriptionWindow | null>(
    (worst, window) => (worst === null || window.usedPercent > worst.usedPercent ? window : worst),
    null,
  );
}

export function headroom(window: SubscriptionWindow): number {
  return Math.max(0, 100 - window.usedPercent);
}

export type AllowancePressure = "comfortable" | "tight" | "critical";

/**
 * Three discrete steps rather than a continuous gradient, so the state is
 * nameable in text as well as colour. The bar used to render the same accent
 * gradient at 5% used and at 95% used, which told you nothing at a glance.
 */
export function pressureOf(usedPercent: number): AllowancePressure {
  if (usedPercent > 85) return "critical";
  if (usedPercent > 60) return "tight";
  return "comfortable";
}

export const PRESSURE_LABELS: Record<AllowancePressure, string> = {
  comfortable: "Comfortable",
  tight: "Getting tight",
  critical: "Nearly used up",
};
