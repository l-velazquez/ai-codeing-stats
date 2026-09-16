import type { SubscriptionUsage, SubscriptionWindow } from "@shared/types";
import { windowAfterReset } from "@shared/allowance";
import { runwayFor } from "@renderer/lib/runway";

/** Human countdown to a window reset. */
export function resetText(timestamp: number, now = Date.now()): string {
  const remaining = timestamp - now;
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
export function worstWindow(usage: SubscriptionUsage, now = Date.now()): SubscriptionWindow | null {
  if (!isLive(usage)) return null;
  return usage.windows.map((window) => windowAfterReset(window, now)).reduce<SubscriptionWindow | null>(
    (worst, window) => (worst === null || window.usedPercent > worst.usedPercent ? window : worst),
    null,
  );
}

export function headroom(window: SubscriptionWindow, now = Date.now()): number {
  return Math.max(0, 100 - windowAfterReset(window, now).usedPercent);
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

const PRESSURE_RANK: Record<AllowancePressure, number> = { comfortable: 0, tight: 1, critical: 2 };

/**
 * Pressure including pace, not just the percentage consumed.
 *
 * `pressureOf` alone reads a window at 24% used as comfortable even when the
 * burn rate says it dies in under an hour, which is exactly the reading the
 * home screen exists to catch. A window on track to hit its limit before the
 * reset is at least tight, and critical once the runway is under half an hour.
 */
export function pressureFor(window: SubscriptionWindow, now = Date.now()): AllowancePressure {
  const current = windowAfterReset(window, now);
  const base = pressureOf(current.usedPercent);
  const projection = runwayFor(current, now);
  if (projection === null || projection.survivesWindow) return base;
  const paced: AllowancePressure = projection.runwayMs <= 30 * 60_000 ? "critical" : "tight";
  return PRESSURE_RANK[paced] > PRESSURE_RANK[base] ? paced : base;
}

/**
 * How urgent a window is, as a sort key of (tier, value) compared ascending.
 *
 * Tier 0 is a window projected to hit its limit before it resets, ordered by
 * how soon. Tier 1 is everything else, ordered fullest first. The split
 * matters because a reset refills the allowance: a window you are not going to
 * exhaust never stops you, however close to the reset it is, so its time-to-
 * reset must not be read as runway.
 */
function urgency(window: SubscriptionWindow, now: number): [number, number] {
  const projected = runwayFor(window, now);
  if (projected !== null && !projected.survivesWindow) return [0, projected.runwayMs];
  return [1, -window.usedPercent];
}

function moreUrgent(a: SubscriptionWindow, b: SubscriptionWindow, now: number): boolean {
  const [tierA, valueA] = urgency(a, now);
  const [tierB, valueB] = urgency(b, now);
  return tierA !== tierB ? tierA < tierB : valueA < valueB;
}

/**
 * The window that stops you first, which is not the same as the fullest one: a
 * weekly window at 70% can have a day and a half of runway left while a
 * five-hour window at 60% has twenty minutes. `worstWindow` answers "most
 * consumed"; this answers "what stops you first", which is the question the
 * home screen leads with.
 */
export function tightestWindow(
  usage: SubscriptionUsage,
  now = Date.now(),
): SubscriptionWindow | null {
  if (!isLive(usage)) return null;
  return usage.windows.map((window) => windowAfterReset(window, now)).reduce<SubscriptionWindow | null>(
    (tightest, window) =>
      tightest === null || moreUrgent(window, tightest, now) ? window : tightest,
    null,
  );
}

/** The provider and window the home screen leads with, across every provider. */
export function leadAllowance(
  subscriptions: readonly SubscriptionUsage[],
  now = Date.now(),
): { usage: SubscriptionUsage; window: SubscriptionWindow } | null {
  let lead: { usage: SubscriptionUsage; window: SubscriptionWindow } | null = null;
  for (const usage of subscriptions) {
    const window = tightestWindow(usage, now);
    if (!window) continue;
    if (lead === null || moreUrgent(window, lead.window, now)) lead = { usage, window };
  }
  return lead;
}
