import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => tmpdir() },
  screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }] },
}));

const { __setSettingsPathForTests, readSettings, usableBounds, writeSettings } = await import("./settingsStore");

function freshPath(): string {
  const path = join(mkdtempSync(join(tmpdir(), "tokenary-settings-")), "settings.json");
  __setSettingsPathForTests(path);
  return path;
}

afterEach(() => __setSettingsPathForTests(null));

describe("settings store", () => {
  it("returns defaults when the file is absent", () => {
    freshPath();
    expect(readSettings().theme).toBe("system");
  });

  it("persists and reads back a patch", () => {
    const path = freshPath();
    writeSettings({ theme: "light", range: "90d" });
    __setSettingsPathForTests(path);
    const read = readSettings();
    expect(read.theme).toBe("light");
    expect(read.range).toBe("90d");
    expect(JSON.parse(readFileSync(path, "utf8")).theme).toBe("light");
  });

  it("merges rather than replacing", () => {
    const path = freshPath();
    writeSettings({ theme: "dark" });
    writeSettings({ range: "7d" });
    __setSettingsPathForTests(path);
    expect(readSettings()).toMatchObject({ theme: "dark", range: "7d" });
  });

  it("recovers from a corrupt file instead of throwing", () => {
    const path = freshPath();
    writeFileSync(path, "{ this is not json");
    __setSettingsPathForTests(path);
    expect(() => readSettings()).not.toThrow();
    expect(readSettings().theme).toBe("system");
  });

  it("rejects out-of-range values written by hand", () => {
    const path = freshPath();
    writeFileSync(path, JSON.stringify({ theme: "neon", subscriptionPollSeconds: 99999 }));
    __setSettingsPathForTests(path);
    const read = readSettings();
    expect(read.theme).toBe("system");
    expect(read.subscriptionPollSeconds).toBe(300);
  });
});

describe("usableBounds", () => {
  it("passes through bounds that intersect a display", () => {
    expect(usableBounds({ width: 800, height: 600, x: 100, y: 100 })).toEqual({
      width: 800,
      height: 600,
      x: 100,
      y: 100,
    });
  });

  it("drops a position stranded off every display but keeps the size", () => {
    expect(usableBounds({ width: 800, height: 600, x: 9000, y: 9000 })).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("passes through size-only bounds and null", () => {
    expect(usableBounds({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
    expect(usableBounds(null)).toBeNull();
  });
});
