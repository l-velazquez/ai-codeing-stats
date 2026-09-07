import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, DEFAULT_SETTINGS, normalizeSettings, resolveTheme, themeBackground } from "./settings";

describe("normalizeSettings", () => {
  it("returns defaults for non-objects", () => {
    for (const input of [null, undefined, 42, "nope", [], true]) {
      expect(normalizeSettings(input)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("keeps valid values", () => {
    expect(
      normalizeSettings({
        version: 1,
        theme: "light",
        range: "90d",
        subscriptionPollSeconds: 30,
        window: { width: 1200, height: 800, x: 10, y: 20 },
        sidebarCollapsed: true,
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      version: 1,
      theme: "light",
      range: "90d",
      subscriptionPollSeconds: 30,
      window: { width: 1200, height: 800, x: 10, y: 20 },
      sidebarCollapsed: true,
    });
  });

  it("falls back per-field rather than discarding the whole file", () => {
    const result = normalizeSettings({ theme: "chartreuse", range: "90d" });
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(result.range).toBe("90d");
  });

  it("clamps the poll interval into a sane band", () => {
    expect(normalizeSettings({ subscriptionPollSeconds: 0 }).subscriptionPollSeconds).toBe(15);
    expect(normalizeSettings({ subscriptionPollSeconds: 1 }).subscriptionPollSeconds).toBe(5);
    expect(normalizeSettings({ subscriptionPollSeconds: 99999 }).subscriptionPollSeconds).toBe(300);
  });

  it("drops window bounds that are not usable", () => {
    expect(normalizeSettings({ window: { width: 0, height: 100 } }).window).toBeNull();
    expect(normalizeSettings({ window: { width: Number.NaN, height: 1 } }).window).toBeNull();
    expect(normalizeSettings({ window: "big" }).window).toBeNull();
  });

  it("keeps window size when position is absent", () => {
    expect(normalizeSettings({ window: { width: 1000, height: 700 } }).window).toEqual({
      width: 1000,
      height: 700,
    });
  });

  it("only treats a real boolean as a hidden sidebar", () => {
    expect(normalizeSettings({ sidebarCollapsed: true }).sidebarCollapsed).toBe(true);
    // A truthy string from a hand-edited file must not hide the whole navigation.
    expect(normalizeSettings({ sidebarCollapsed: "yes" }).sidebarCollapsed).toBe(false);
    expect(normalizeSettings({}).sidebarCollapsed).toBe(false);
  });

  it("preserves supported accents and upgrades old or invalid preferences safely", () => {
    for (const accent of ["red", "orange", "green", "blue", "pink", "violet"]) {
      expect(normalizeSettings({ accent, theme: "light" })).toMatchObject({ accent, theme: "light" });
    }
    for (const accent of [undefined, null, "invalid", 42]) {
      expect(normalizeSettings({ accent }).accent).toBe("blue");
    }
  });

  it("keeps the contributions ledger oldest-first unless newest is stored", () => {
    expect(normalizeSettings({}).contributionsOrder).toBe("oldest");
    expect(normalizeSettings({ contributionsOrder: "newest" }).contributionsOrder).toBe("newest");
    for (const value of [undefined, null, "sideways", 42, true]) {
      expect(normalizeSettings({ contributionsOrder: value }).contributionsOrder).toBe("oldest");
    }
  });

  it("always reports version 1", () => {
    expect(normalizeSettings({ version: 99 }).version).toBe(1);
  });
});

describe("resolveTheme", () => {
  it("passes explicit preferences through regardless of the system", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("follows the system only when asked to", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("themeBackground", () => {
  it("mixes 7% of the accent into the theme's ground, matching --bg", () => {
    // #05080c with 7% of blue #2460ff: round(5*.93 + 36*.07) = 7, and so on.
    expect(themeBackground("dark", "blue")).toBe("#070e1d");
    expect(themeBackground("light", "blue")).toBe("#e1e9f8");
  });

  it("returns a distinct six-digit hex per accent", () => {
    const grounds = ACCENT_COLORS.map((accent) => themeBackground("dark", accent));
    for (const ground of grounds) expect(ground).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(grounds).size).toBe(ACCENT_COLORS.length);
  });
});
