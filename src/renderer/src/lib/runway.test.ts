import { describe, expect, it } from "vitest";
import type { SubscriptionUsage, SubscriptionWindow } from "@shared/types";
import { runwayFor } from "./runway";
import { leadAllowance, pressureFor, pressureOf, tightestWindow, worstWindow } from "./allowance";

// A fixed clock. These assertions are all about elapsed fractions of a window,
// so a test that read the real time would be asserting against itself.
const NOW = Date.parse("2026-09-06T13:40:00.000Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A window `elapsedMs` into its own length, with `usedPercent` consumed. */
function windowAt(
  usedPercent: number,
  elapsedMs: number,
  windowMinutes = 300,
  label = "5-hour limit",
): SubscriptionWindow {
  return {
    label,
    usedPercent,
    windowMinutes,
    resetsAt: NOW - elapsedMs + windowMinutes * MINUTE,
  };
}

function usage(
  windows: SubscriptionWindow[],
  provider: "claude" | "codex" = "claude",
): SubscriptionUsage {
  return { provider, state: "live", plan: null, updatedAt: NOW, windows, detail: "" };
}

describe("runwayFor", () => {
  it("projects exhaustion before the reset when the pace is too high", () => {
    // 60% gone in the first two hours of five: 150% by the reset.
    const projection = runwayFor(windowAt(60, 2 * HOUR), NOW);
    expect(projection?.survivesWindow).toBe(false);
    expect(projection?.projectedPercent).toBeCloseTo(150, 6);
    // 100% is reached 3h20m in, which is 1h20m from now.
    expect(projection?.runwayMs).toBeCloseTo(80 * MINUTE, 6);
    expect(projection?.exhaustsAt).toBeCloseTo(NOW + 80 * MINUTE, 6);
  });

  it("runs to the reset when the pace outlasts the window", () => {
    const projection = runwayFor(windowAt(20, 2 * HOUR), NOW);
    expect(projection?.survivesWindow).toBe(true);
    expect(projection?.projectedPercent).toBeCloseTo(50, 6);
    expect(projection?.exhaustsAt).toBeNull();
    expect(projection?.runwayMs).toBeCloseTo(3 * HOUR, 6);
  });

  it("treats landing exactly on the limit as surviving", () => {
    const projection = runwayFor(windowAt(40, 2 * HOUR), NOW);
    expect(projection?.projectedPercent).toBeCloseTo(100, 6);
    expect(projection?.survivesWindow).toBe(true);
    expect(projection?.exhaustsAt).toBeNull();
  });

  it("reports no runway left once the allowance is already spent", () => {
    const projection = runwayFor(windowAt(100, 2 * HOUR), NOW);
    expect(projection?.survivesWindow).toBe(false);
    expect(projection?.runwayMs).toBe(0);
  });

  it("declines to project when too little of the window has elapsed", () => {
    expect(runwayFor(windowAt(5, 4 * MINUTE), NOW)).toBeNull();
    // Seventeen minutes into five hours: a real reading that used to project
    // a burst into an alarming figure, then collapse on the next sample.
    expect(runwayFor(windowAt(24, 17 * MINUTE), NOW)).toBeNull();
    // Just past both floors.
    expect(runwayFor(windowAt(24, 46 * MINUTE), NOW)).not.toBeNull();
  });

  it("declines to project when the elapsed share of a long window is too small", () => {
    // Six hours into a seven-day window is past the five-minute floor but only
    // 3.6% of the window: the denominator is still noise.
    expect(runwayFor(windowAt(2, 6 * HOUR, 7 * 24 * 60, "Weekly limit"), NOW)).toBeNull();
  });

  it("declines to project a window that has not opened yet", () => {
    expect(runwayFor(windowAt(10, -1 * HOUR), NOW)).toBeNull();
  });

  it("declines to project a window that has already reset", () => {
    const reset = { ...windowAt(80, 2 * HOUR), resetsAt: NOW - MINUTE };
    expect(runwayFor(reset, NOW)).toBeNull();
  });

  it("declines to project with no usage recorded, or no window length", () => {
    expect(runwayFor(windowAt(0, 2 * HOUR), NOW)).toBeNull();
    expect(runwayFor(windowAt(30, 2 * HOUR, 0), NOW)).toBeNull();
  });
});

describe("tightestWindow", () => {
  it("prefers the window that runs out first over the one that is fullest", () => {
    // Weekly is further along in percentage terms, but its projected
    // exhaustion is a day and a half out; the five-hour bites in 80 minutes.
    const weekly = windowAt(70, 4 * DAY, 7 * 24 * 60, "Weekly limit");
    const short = windowAt(60, 2 * HOUR);
    expect(worstWindow(usage([short, weekly]))?.label).toBe("Weekly limit");
    expect(tightestWindow(usage([short, weekly]), NOW)?.label).toBe("5-hour limit");
  });

  it("still ranks a nearly-spent window as urgent when it cannot be projected", () => {
    // Four minutes in, so there is no pace to read -- but 95% is gone.
    const spent = windowAt(95, 4 * MINUTE, 300, "5-hour limit");
    const weekly = windowAt(20, 2 * DAY, 7 * 24 * 60, "Weekly limit");
    expect(tightestWindow(usage([weekly, spent]), NOW)?.label).toBe("5-hour limit");
  });

  it("is null when nothing is being reported", () => {
    expect(tightestWindow(usage([]), NOW)).toBeNull();
    expect(tightestWindow({ ...usage([windowAt(50, 2 * HOUR)]), state: "unavailable" }, NOW)).toBeNull();
  });
});

describe("leadAllowance", () => {
  it("leads with whichever provider runs out first", () => {
    const claude = usage([windowAt(60, 2 * HOUR)], "claude");
    const codex = usage([windowAt(90, 2 * HOUR)], "codex");
    expect(leadAllowance([claude, codex], NOW)?.usage.provider).toBe("codex");
  });

  it("skips providers that are not reporting", () => {
    const claude = { ...usage([windowAt(60, 2 * HOUR)], "claude"), state: "unavailable" as const };
    const codex = usage([windowAt(10, 2 * HOUR)], "codex");
    expect(leadAllowance([claude, codex], NOW)?.usage.provider).toBe("codex");
    expect(leadAllowance([claude], NOW)).toBeNull();
    expect(leadAllowance([], NOW)).toBeNull();
  });
});

describe("pressureFor", () => {
  it("escalates a lightly-used window that is burning too fast to last", () => {
    // 24% used reads comfortable on the percentage alone, but at this pace it
    // is gone well before the reset.
    const burning = windowAt(24, 46 * MINUTE);
    expect(pressureOf(burning.usedPercent)).toBe("comfortable");
    expect(pressureFor(burning, NOW)).toBe("tight");
  });

  it("calls it critical once the runway is under half an hour", () => {
    // 70% gone in the first hour of five. The percentage alone says tight; the
    // pace puts the limit about 26 minutes out, which is critical.
    const imminent = windowAt(70, 60 * MINUTE);
    expect(pressureOf(imminent.usedPercent)).toBe("tight");
    expect(runwayFor(imminent, NOW)?.runwayMs).toBeLessThan(30 * MINUTE);
    expect(pressureFor(imminent, NOW)).toBe("critical");
  });

  it("leaves a window that lasts to its reset on the percentage alone", () => {
    expect(pressureFor(windowAt(20, 2 * HOUR), NOW)).toBe("comfortable");
    expect(pressureFor(windowAt(70, 2 * HOUR, 7 * 24 * 60), NOW)).toBe("tight");
  });

  it("falls back to the percentage when there is no pace to read", () => {
    expect(pressureFor(windowAt(95, 4 * MINUTE), NOW)).toBe("critical");
    expect(pressureFor(windowAt(10, 4 * MINUTE), NOW)).toBe("comfortable");
  });
});
