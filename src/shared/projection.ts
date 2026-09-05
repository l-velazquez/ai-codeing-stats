const DAY = 86_400_000;

export const PACE_WINDOW_DAYS = 30;

/**
 * How many days of real history the pace window actually covers.
 *
 * A brand-new install with two days of data should not be told its monthly
 * pace is 1/15th of what it is really spending, so the divisor is the elapsed
 * span rather than a flat 30. It is clamped to at least one day (so a first-day
 * install does not divide by a fraction and report an absurd figure) and to at
 * most the window length.
 */
export function paceCoverageDays(
  firstTimestamp: number | null,
  now: number,
  windowDays: number = PACE_WINDOW_DAYS,
): number {
  if (firstTimestamp === null) return windowDays;
  const start = Math.max(firstTimestamp, now - windowDays * DAY);
  return Math.min(windowDays, Math.max(1, (now - start) / DAY));
}

/**
 * Projected spend for a 30-day month.
 *
 * `windowCost` must be the cost accrued inside the trailing window only. Taking
 * the window rather than the selected range is what keeps this range
 * independent: previously a 90-day range divided 90 days of cost by a divisor
 * clamped to 30, reporting roughly triple the real pace.
 */
export function monthlyPace(
  windowCost: number,
  firstTimestamp: number | null,
  now: number,
  windowDays: number = PACE_WINDOW_DAYS,
): number {
  if (!Number.isFinite(windowCost) || windowCost <= 0) return 0;
  return (windowCost / paceCoverageDays(firstTimestamp, now, windowDays)) * windowDays;
}

export function paceWindowStart(now: number, windowDays: number = PACE_WINDOW_DAYS): number {
  return now - windowDays * DAY;
}
