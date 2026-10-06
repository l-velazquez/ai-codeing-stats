import { expect, it } from "vitest";
import { windowAfterReset } from "./allowance";
import type { SubscriptionWindow } from "./types";

const window_: SubscriptionWindow = {
  label: "Session limit",
  usedPercent: 64,
  windowMinutes: 300,
  resetsAt: 10_000,
};

it("keeps the last percentage before the known reset", () => {
  expect(windowAfterReset(window_, 9_999)).toBe(window_);
});

it("resets usage at the known reset timestamp without a new report", () => {
  expect(windowAfterReset(window_, 10_000)).toMatchObject({
    usedPercent: 0,
    resetsAt: 10_000,
  });
});
