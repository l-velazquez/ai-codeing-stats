import { describe, expect, it } from "vitest";
import { monthlyPace, paceCoverageDays, paceWindowStart, PACE_WINDOW_DAYS } from "./projection";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);

describe("paceCoverageDays", () => {
  it("uses the full window when there is no history", () => {
    expect(paceCoverageDays(null, NOW)).toBe(PACE_WINDOW_DAYS);
  });

  it("caps at the window length for long histories", () => {
    expect(paceCoverageDays(NOW - 400 * DAY, NOW)).toBe(30);
  });

  it("uses the elapsed span for a short history", () => {
    expect(paceCoverageDays(NOW - 4 * DAY, NOW)).toBeCloseTo(4, 6);
  });

  it("never divides by less than a day", () => {
    expect(paceCoverageDays(NOW - 60_000, NOW)).toBe(1);
  });
});

describe("monthlyPace", () => {
  it("is zero for no spend", () => {
    expect(monthlyPace(0, NOW - 10 * DAY, NOW)).toBe(0);
  });

  it("projects a steady daily rate to a 30-day month", () => {
    // $2/day for the whole window -> $60/month
    expect(monthlyPace(60, NOW - 200 * DAY, NOW)).toBeCloseTo(60, 6);
  });

  it("extrapolates from a partial history rather than under-reporting", () => {
    // $30 spent over 3 days of history -> $10/day -> $300/month
    expect(monthlyPace(30, NOW - 3 * DAY, NOW)).toBeCloseTo(300, 6);
  });

  it("does not change when the caller looks at a longer range", () => {
    // The window cost is what matters; a 90d or all-time range passes the same
    // trailing-window total, so the answer is identical. This is the defect the
    // old (totalCost / clamp(30)) * 30 formula had: 90 days of cost divided by a
    // divisor pinned to 30 reported roughly triple the real pace.
    const long = monthlyPace(60, NOW - 400 * DAY, NOW);
    const short = monthlyPace(60, NOW - 90 * DAY, NOW);
    expect(long).toBeCloseTo(short, 6);
  });

  it("ignores non-finite input", () => {
    expect(monthlyPace(Number.NaN, NOW, NOW)).toBe(0);
    expect(monthlyPace(Number.POSITIVE_INFINITY, NOW, NOW)).toBe(0);
  });
});

describe("paceWindowStart", () => {
  it("is 30 days before now", () => {
    expect(paceWindowStart(NOW)).toBe(NOW - 30 * DAY);
  });
});
