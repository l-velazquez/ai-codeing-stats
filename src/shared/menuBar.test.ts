import { expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";
import { allowanceIsStale, localDayKey, menuBarTitle, type MenuBarState } from "./menuBar";
import { panelBounds } from "./panelBounds";

const now = new Date(2026, 8, 5, 12).getTime();
const state = (): MenuBarState => ({ refreshing: false, error: null, summary: {
  day: localDayKey(now), updatedAt: now, cost: 12.4, tokens: 1000, pricedPercent: 1, providers: [],
  sources: [{ provider: "codex", label: "Codex", state: "connected", path: "", files: 1, records: 1, detail: "" }],
  subscriptions: [{ provider: "codex", state: "live", plan: null, updatedAt: now, detail: "", windows: [
    { label: "Session", windowMinutes: 300, resetsAt: now + 3600_000, usedPercent: 20 },
    { label: "Weekly", windowMinutes: 10_080, resetsAt: now + 86400_000, usedPercent: 70 },
  ] }],
} });

it("formats each display mode and selects provider/window explicitly", () => {
  expect(menuBarTitle(state(), DEFAULT_SETTINGS, now)).toBe("$12.40");
  expect(menuBarTitle(state(), { ...DEFAULT_SETTINGS, menuBarDisplay: "icon" }, now)).toBe("");
  expect(menuBarTitle(state(), { ...DEFAULT_SETTINGS, menuBarDisplay: "both" }, now)).toBe("$12.40 · Cx 5h 80%");
  expect(menuBarTitle(state(), { ...DEFAULT_SETTINGS, menuBarDisplay: "allowance", menuBarWindow: "weekly" }, now)).toBe("Cx 7d 30%");
  expect(menuBarTitle(state(), { ...DEFAULT_SETTINGS, menuBarDisplay: "allowance", menuBarProvider: "claude" }, now)).toBe("Cl short —");
});

it("does not label yesterday's cost as today or unavailable sources as zero", () => {
  expect(menuBarTitle(state(), DEFAULT_SETTINGS, now + 86400_000)).toBe("—");
  const missing = state();
  expect(menuBarTitle({ ...missing, summary: { ...missing.summary!, sources: [] } }, DEFAULT_SETTINGS, now)).toBe("—");
  expect(menuBarTitle({ summary: null, error: null, refreshing: true }, DEFAULT_SETTINGS, now)).toBe("—");
});

it("marks partial and failed estimates, and suppresses stale allowance percentages", () => {
  const good = state();
  expect(menuBarTitle({ ...good, summary: { ...good.summary!, pricedPercent: .5 } }, DEFAULT_SETTINGS, now)).toBe("$12.40*");
  expect(menuBarTitle({ ...good, error: "failed" }, { ...DEFAULT_SETTINGS, menuBarDisplay: "both" }, now)).toBe("$12.40* · Cx 5h —");
  const usage = good.summary!.subscriptions[0];
  expect(allowanceIsStale(usage, usage.windows[0], now + 16 * 60_000)).toBe(true);
  expect(allowanceIsStale(usage, { ...usage.windows[0], resetsAt: now }, now)).toBe(true);
});

it("migrates old settings safely and rejects malformed menu bar preferences", () => {
  expect(normalizeSettings({ theme: "light" })).toMatchObject({ menuBarEnabled: true, menuBarDisplay: "cost" });
  expect(normalizeSettings({ menuBarEnabled: "false", menuBarDisplay: "bogus", menuBarProvider: "opencode", menuBarWindow: "daily" }))
    .toMatchObject({ menuBarEnabled: true, menuBarDisplay: "cost", menuBarProvider: "codex", menuBarWindow: "session" });
  expect(normalizeSettings({ menuBarEnabled: false, menuBarDisplay: "both", menuBarProvider: "claude", menuBarWindow: "weekly" }))
    .toMatchObject({ menuBarEnabled: false, menuBarDisplay: "both", menuBarProvider: "claude", menuBarWindow: "weekly" });
});

it("keeps the popover on small and negative-coordinate displays", () => {
  expect(panelBounds({ x: -15, y: 0, width: 15, height: 24 }, { x: -1440, y: 24, width: 1440, height: 900 }))
    .toEqual({ x: -360, y: 30, width: 360, height: 620 });
  expect(panelBounds({ x: 0, y: 0, width: 15, height: 24 }, { x: 0, y: 24, width: 320, height: 450 }))
    .toEqual({ x: 0, y: 24, width: 320, height: 450 });
});
