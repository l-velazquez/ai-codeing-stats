import type { SubscriptionWindow } from "@shared/types";

/**
 * How much longer you can keep working before an allowance window stops you.
 *
 * Allowance history is never persisted -- `SubscriptionWindow` is a
 * point-in-time read of what the provider last reported -- so there is exactly
 * one measured point to work from. The pace is therefore the average across
 * the window so far, and everything past "now" is extrapolation. The UI draws
 * that part dashed and always words it "on this pace" for the same reason.
 *
 * Known bias: Claude's five-hour window is rolling, so usage from the start of
 * the window ages out of it. A straight line over-predicts exhaustion when a
 * session was front-loaded. Under-promising when someone is about to lose their
 * agent mid-task is the right direction to be wrong in.
 */

/**
 * A projection needs enough of the window behind it to mean anything, on two
 * axes. The absolute floor stops a freshly-reset window projecting at all; the
 * fractional floor makes a long window earn proportionally more evidence
 * before it will. Both were far lower to begin with, and seventeen minutes
 * into a five-hour window a short burst extrapolated into an alarming figure
 * that then collapsed on the next reading.
 */
const MIN_ELAPSED_MS = 20 * 60_000;
const MIN_ELAPSED_FRACTION = 0.15;

export interface Runway {
  /** When the window opened: `resetsAt` less its own length. */
  readonly startedAt: number;
  /** How far through the window we are, 0..1. */
  readonly elapsedFraction: number;
  /** Allowance used by the time the window resets, at the measured pace. */
  readonly projectedPercent: number;
  /** When the allowance hits 100%, or null when the pace outlasts the window. */
  readonly exhaustsAt: number | null;
  /** Usable time left: to exhaustion, or to the reset when it never comes. */
  readonly runwayMs: number;
  /** True when the pace lasts to the reset without running out. */
  readonly survivesWindow: boolean;
}

/**
 * Null whenever the reading cannot support a projection -- too early in the
 * window, no usage yet, or the window has already reset. Callers show plain
 * headroom in that case rather than a number nobody should act on.
 */
export function runwayFor(window: SubscriptionWindow, now = Date.now()): Runway | null {
  const windowMs = window.windowMinutes * 60_000;
  if (!(windowMs > 0)) return null;
  if (now >= window.resetsAt) return null;
  if (!(window.usedPercent > 0)) return null;

  const startedAt = window.resetsAt - windowMs;
  const elapsedMs = now - startedAt;
  // Also catches a reading from before the window opened, where elapsed is
  // negative and the rate would come out backwards.
  if (elapsedMs < MIN_ELAPSED_MS) return null;

  const elapsedFraction = elapsedMs / windowMs;
  if (elapsedFraction < MIN_ELAPSED_FRACTION) return null;

  const rate = window.usedPercent / elapsedMs;
  const projectedPercent = rate * windowMs;

  if (projectedPercent <= 100) {
    return {
      startedAt,
      elapsedFraction,
      projectedPercent,
      exhaustsAt: null,
      runwayMs: window.resetsAt - now,
      survivesWindow: true,
    };
  }

  const exhaustsAt = startedAt + 100 / rate;
  return {
    startedAt,
    elapsedFraction,
    projectedPercent,
    exhaustsAt,
    runwayMs: Math.max(0, exhaustsAt - now),
    survivesWindow: false,
  };
}
