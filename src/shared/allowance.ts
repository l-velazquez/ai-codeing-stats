import type { SubscriptionWindow } from "./types";

/**
 * Applies a reset that the provider has already told us about.
 *
 * Allowance reports are point-in-time readings. Once their known reset time
 * passes, the last percentage is no longer the current usage, but it is still
 * enough information to know that the window is full again. Keeping the reset
 * timestamp lets the UI make that change without waiting for another provider
 * report.
 */
export function windowAfterReset(
  window: SubscriptionWindow,
  now = Date.now(),
): SubscriptionWindow {
  if (window.resetsAt > now) return window;
  return { ...window, usedPercent: 0 };
}
