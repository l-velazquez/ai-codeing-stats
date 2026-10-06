import { expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";
import { allowanceIsStale, localDayKey, menuBarTitle, remainingPercent, type MenuBarState } from "./menuBar";
import { PANEL_WIDTH, panelBounds, panelHeight } from "./panelBounds";

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
  expect(menuBarTitle(state(), { ...DEFAULT_SETTINGS, menuBarDisplay: "both" }, now)).toBe("$12.40 · Codex 5h 80%");
  expect(menuBarTitle(state(), { ...DEFAULT_SETTINGS, menuBarDisplay: "allowance" }, now)).toBe("Codex 5h · 80% left");
  expect(menuBarTitle(state(), { ...DEFAULT_SETTINGS, menuBarDisplay: "allowance", menuBarWindow: "weekly" }, now)).toBe("Codex weekly · 30% left");
  // No window at all reads as a bare provider, never an invented period.
  expect(menuBarTitle(state(), { ...DEFAULT_SETTINGS, menuBarDisplay: "allowance", menuBarProvider: "claude" }, now)).toBe("Claude —");
});

it("does not label yesterday's cost as today or unavailable sources as zero", () => {
  expect(menuBarTitle(state(), DEFAULT_SETTINGS, now + 86400_000)).toBe("—");
  const missing = state();
  expect(menuBarTitle({ ...missing, summary: { ...missing.summary!, sources: [] } }, DEFAULT_SETTINGS, now)).toBe("—");
  expect(menuBarTitle({ summary: null, error: null, refreshing: true }, DEFAULT_SETTINGS, now)).toBe("—");
});

it("marks partial estimates while retaining the last allowance percentage", () => {
  const good = state();
  expect(menuBarTitle({ ...good, summary: { ...good.summary!, pricedPercent: .5 } }, DEFAULT_SETTINGS, now)).toBe("$12.40*");
  expect(menuBarTitle({ ...good, error: "failed" }, { ...DEFAULT_SETTINGS, menuBarDisplay: "both" }, now)).toBe("$12.40* · Codex 5h 80%");
  // A report older than the freshness hint keeps its last known percentage.
  expect(menuBarTitle({ ...good, error: "failed" }, { ...DEFAULT_SETTINGS, menuBarDisplay: "allowance" }, now + 16 * 60_000)).toBe("Codex 5h · 80% left");
  expect(remainingPercent({ ...good.summary!.subscriptions[0]!.windows[0]!, resetsAt: now - 1 }, now)).toBe(100);
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
  expect(panelBounds({ x: -15, y: 0, width: 15, height: 24 }, { x: -1440, y: 24, width: 1440, height: 900 }, PANEL_WIDTH, 620))
    .toEqual({ x: -400, y: 30, width: 400, height: 620 });
  expect(panelBounds({ x: 0, y: 0, width: 15, height: 24 }, { x: 0, y: 24, width: 320, height: 450 }, PANEL_WIDTH, 620))
    .toEqual({ x: 0, y: 24, width: 320, height: 450 });
});

const anchor = { x: 0, y: 0, width: 15, height: 24 };
const wide = { x: 0, y: 24, width: 1440, height: 900 };

it("fits the panel to its content and only scrolls when the display runs out", () => {
  // 900 tall work area starting at y=24, tray bottom at 24, 6px gap -> 894 available.
  expect(panelHeight(480, anchor, wide)).toBe(480);
  expect(panelHeight(480.4, anchor, wide)).toBe(481);
  expect(panelHeight(1200, anchor, wide)).toBe(894);
  expect(panelHeight(0, anchor, wide)).toBe(300);
  expect(panelHeight(120, anchor, wide)).toBe(300);
});

it("keeps a usable panel when the tray leaves almost no room beneath it", () => {
  expect(panelHeight(500, anchor, { x: 0, y: 24, width: 1440, height: 200 })).toBe(200);
  // A tray reported below its own work area must not yield a zero-height panel.
  expect(panelHeight(500, { x: 0, y: 2000, width: 15, height: 24 }, wide)).toBe(300);
});

it("anchors a content-fitted panel under the tray with its gap intact", () => {
  expect(panelBounds(anchor, wide, PANEL_WIDTH, panelHeight(500, anchor, wide)))
    .toEqual({ x: 0, y: 30, width: 400, height: 500 });
});
