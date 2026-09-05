import { describe, expect, it } from "vitest";
import type { SubscriptionUsage, SubscriptionWindow } from "@shared/types";
import { headroom, isLive, PRESSURE_LABELS, pressureOf, resetText, worstWindow } from "./allowance";

function window_(usedPercent: number, label = "5-hour limit"): SubscriptionWindow {
  return { label, usedPercent, windowMinutes: 300, resetsAt: Date.now() + 3_600_000 };
}

function usage(windows: SubscriptionWindow[], state: "live" | "unavailable" = "live"): SubscriptionUsage {
  return { provider: "claude", state, plan: null, updatedAt: Date.now(), windows, detail: "" };
}

describe("isLive", () => {
  it("requires both a live state and at least one window", () => {
    expect(isLive(usage([window_(10)]))).toBe(true);
    expect(isLive(usage([]))).toBe(false);
    expect(isLive(usage([window_(10)], "unavailable"))).toBe(false);
  });
});

describe("worstWindow", () => {
  it("picks the window closest to its limit", () => {
    const worst = worstWindow(usage([window_(24, "5-hour limit"), window_(81, "Weekly limit")]));
    expect(worst?.label).toBe("Weekly limit");
  });

  it("is null when nothing is being reported", () => {
    expect(worstWindow(usage([]))).toBeNull();
    expect(worstWindow(usage([window_(50)], "unavailable"))).toBeNull();
  });
});

describe("headroom", () => {
  it("is the inverse of usage and never negative", () => {
    expect(headroom(window_(30))).toBe(70);
    expect(headroom(window_(120))).toBe(0);
  });
});

describe("pressureOf", () => {
  it("uses three discrete steps rather than a gradient", () => {
    expect(pressureOf(0)).toBe("comfortable");
    expect(pressureOf(60)).toBe("comfortable");
    expect(pressureOf(61)).toBe("tight");
    expect(pressureOf(85)).toBe("tight");
    expect(pressureOf(86)).toBe("critical");
  });

  it("names every step, so colour is never the only signal", () => {
    for (const step of ["comfortable", "tight", "critical"] as const) {
      expect(PRESSURE_LABELS[step]).toBeTruthy();
    }
  });
});

describe("resetText", () => {
  it("counts down in the largest useful unit", () => {
    const now = Date.now();
    expect(resetText(now - 1000)).toBe("Reset due");
    expect(resetText(now + 25 * 60_000)).toMatch(/^Resets in 2[45]m$/);
    expect(resetText(now + 3 * 3_600_000)).toMatch(/^Resets in 2h|^Resets in 3h/);
    expect(resetText(now + 50 * 3_600_000)).toMatch(/^Resets in 2d/);
  });
});
