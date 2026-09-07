import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@shared/settings";

// Plain functions rather than vi.fn: a spy's derived result promise surfaces
// rejections this hook has already handled.
let stored: Settings = DEFAULT_SETTINGS;
let read: () => Promise<Settings> = async () => stored;
const writes: Partial<Settings>[] = [];

vi.mock("@renderer/lib/bridge", () => ({
  readSettings: () => read(),
  writeSettings: (patch: Partial<Settings>) => {
    writes.push(patch);
    stored = { ...stored, ...patch };
    return Promise.resolve(stored);
  },
}));

const { useDayOrder } = await import("./useDayOrder");

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  writes.length = 0;
  stored = DEFAULT_SETTINGS;
  read = async () => stored;
});

describe("useDayOrder", () => {
  it("adopts the stored order on mount", async () => {
    stored = { ...DEFAULT_SETTINGS, contributionsOrder: "newest" };
    const { result } = renderHook(() => useDayOrder());
    await flush();
    expect(result.current.order).toBe("newest");
  });

  it("persists each flip", async () => {
    const { result } = renderHook(() => useDayOrder());
    await flush();
    expect(result.current.order).toBe("oldest");

    act(() => result.current.toggle());
    expect(result.current.order).toBe("newest");
    expect(writes).toEqual([{ contributionsOrder: "newest" }]);

    act(() => result.current.toggle());
    expect(result.current.order).toBe("oldest");
    expect(writes.at(-1)).toEqual({ contributionsOrder: "oldest" });
  });

  it("keeps the default when the settings read fails", async () => {
    read = () => Promise.reject(new Error("no bridge"));
    const { result } = renderHook(() => useDayOrder());
    await flush();
    expect(result.current.order).toBe("oldest");
  });
});
