import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@shared/settings";
import type { AzulCodeBridge } from "@shared/types";

let stored: Settings;
let read: () => Promise<Settings>;
const writes: Partial<Settings>[] = [];
let failWrite = false;

vi.mock("@renderer/lib/bridge", () => ({
  readSettings: () => read(),
  writeSettings: (patch: Partial<Settings>) => {
    writes.push(patch);
    if (failWrite) return Promise.reject(new Error("preferences unavailable"));
    stored = { ...stored, ...patch };
    return Promise.resolve(stored);
  },
}));

const { useRange } = await import("./useRange");

beforeEach(() => {
  delete window.azulCode;
  stored = { ...DEFAULT_SETTINGS, range: "90d" };
  read = async () => stored;
  writes.length = 0;
  failWrite = false;
});
afterEach(() => { delete window.azulCode; });

it("restores the stored range without writing defaults over it", async () => {
  const { result } = renderHook(() => useRange());
  await waitFor(() => expect(result.current.range).toBe("90d"));
  expect(writes).toEqual([]);
});

it("persists a selection and restores it when the dashboard is reopened", async () => {
  const first = renderHook(() => useRange());
  act(() => first.result.current.setRange("all"));
  expect(writes).toEqual([{ range: "all" }]);
  first.unmount();
  const next = renderHook(() => useRange());
  await waitFor(() => expect(next.result.current.range).toBe("all"));
});

it("does not let a slow read replace a newer selection", async () => {
  let release!: (settings: Settings) => void;
  read = () => new Promise((resolve) => { release = resolve; });
  const { result } = renderHook(() => useRange());
  act(() => result.current.setRange("7d"));
  await act(async () => { release({ ...DEFAULT_SETTINGS, range: "90d" }); });
  expect(result.current.range).toBe("7d");
  expect(writes).toEqual([{ range: "7d" }]);
});

it("uses the launch hint on the first render and accepts later settings broadcasts", async () => {
  let listener!: (settings: Settings) => void;
  let release!: (settings: Settings) => void;
  const unsubscribe = vi.fn();
  read = () => new Promise((resolve) => { release = resolve; });
  window.azulCode = {
    initial: { range: "all", theme: "system", resolved: "dark", sidebarCollapsed: false },
    onSettingsChanged: (callback: (settings: Settings) => void) => { listener = callback; return unsubscribe; },
  } as unknown as AzulCodeBridge;
  const { result, unmount } = renderHook(() => useRange());
  expect(result.current.range).toBe("all");
  act(() => listener({ ...DEFAULT_SETTINGS, range: "7d" }));
  await act(async () => { release({ ...DEFAULT_SETTINGS, range: "90d" }); });
  expect(result.current.range).toBe("7d");
  expect(writes).toEqual([]);
  unmount();
  expect(unsubscribe).toHaveBeenCalledOnce();
});

it("keeps the range usable when reading or saving preferences fails", async () => {
  read = () => Promise.reject(new Error("preferences unavailable"));
  failWrite = true;
  const { result } = renderHook(() => useRange());
  await act(async () => {});
  expect(result.current.range).toBe("30d");
  await act(async () => result.current.setRange("7d"));
  expect(result.current.range).toBe("7d");
});
