import { describe, expect, it } from "vitest";
import { ACCENT_COLORS, CUSTOM_ACCENT_DEFAULT, customAccentVars, DEFAULT_SETTINGS, normalizeHexColor, normalizeSettings, resolveTheme, themeBackground } from "./settings";

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
    for (const accent of [...ACCENT_COLORS, "custom"]) {
      expect(normalizeSettings({ accent, theme: "light" })).toMatchObject({ accent, theme: "light" });
    }
    for (const accent of [undefined, null, "invalid", 42]) {
      expect(normalizeSettings({ accent }).accent).toBe("blue");
    }
  });

  it("normalizes the custom accent hex without ever throwing", () => {
    expect(normalizeSettings({ customAccent: "#FF8800" }).customAccent).toBe("#ff8800");
    // Short form expands; garbage falls back to the default rather than failing.
    expect(normalizeSettings({ customAccent: "#0f0" }).customAccent).toBe("#00ff00");
    for (const value of [undefined, null, "maroon", "#12345", 42, {}]) {
      expect(normalizeSettings({ customAccent: value }).customAccent).toBe(CUSTOM_ACCENT_DEFAULT);
    }
    expect(normalizeHexColor("e8103a")).toBe("#e8103a");
    expect(normalizeHexColor("#F00", "")).toBe("#ff0000");
    expect(normalizeHexColor("nope", "")).toBe("");
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

  it("mixes the picked hex when the accent is custom", () => {
    // #05080c with 7% of #00c8ff: round(5*.93 + 0*.07) = 5, round(8*.93 + 200*.07) = 21,
    // round(12*.93 + 255*.07) = 29.
    expect(themeBackground("dark", "custom", "#00c8ff")).toBe("#05151d");
    // A missing or malformed hex falls back to the default custom colour.
    expect(themeBackground("dark", "custom", undefined)).toBe(themeBackground("dark", "custom", CUSTOM_ACCENT_DEFAULT));
    expect(themeBackground("dark", "custom", "garbage")).toBe(themeBackground("dark", "custom", CUSTOM_ACCENT_DEFAULT));
  });

  it("returns a distinct six-digit hex per accent", () => {
    const grounds = ACCENT_COLORS.map((accent) => themeBackground("dark", accent));
    for (const ground of grounds) expect(ground).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(grounds).size).toBe(ACCENT_COLORS.length);
  });
});

describe("customAccentVars", () => {
  it("derives five valid roles for any picked colour", () => {
    for (const picked of ["#00c8ff", "#7f1d1d", "#ffc0cb", "#000000", "#ffffff", "#123456"]) {
      const vars = customAccentVars(picked);
      for (const value of Object.values(vars)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("keeps the readable bands of the presets: light highlight for dark, darker for white", () => {
    const vars = customAccentVars("#7f1d1d");
    const red = (hex: string) => Number.parseInt(hex.slice(1, 3), 16);
    // The dark-theme highlight must stay light enough to read on a dark page,
    // the light-theme accent dark enough to read on white.
    expect(red(vars["--accent"])).toBeGreaterThanOrEqual(0xd0);
    expect(red(vars["--accent-light"])).toBeLessThanOrEqual(0xc8);
  });

  it("leaves near-greys grey instead of inventing a hue", () => {
    const vars = customAccentVars("#ffffff");
    for (const value of Object.values(vars)) {
      expect(value.slice(1, 3)).toBe(value.slice(3, 5));
      expect(value.slice(3, 5)).toBe(value.slice(5, 7));
    }
  });
});
