import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "@shared/settings";

let stored: Settings = DEFAULT_SETTINGS;
const writes: Partial<Settings>[] = [];

vi.mock("@renderer/lib/bridge", () => ({
  readSettings: () => Promise.resolve(stored),
  writeSettings: (patch: Partial<Settings>) => {
    writes.push(patch);
    stored = { ...stored, ...patch };
    return Promise.resolve(stored);
  },
}));

const { useSidebar } = await import("./useSidebar");

beforeEach(() => {
  stored = DEFAULT_SETTINGS;
  writes.length = 0;
});

describe("useSidebar", () => {
  it("starts from the stored preference", async () => {
    stored = { ...DEFAULT_SETTINGS, sidebarCollapsed: true };
    const { result } = renderHook(() => useSidebar());
    await waitFor(() => expect(result.current.collapsed).toBe(true));
    // Reading a preference is not a change to it.
    expect(writes).toEqual([]);
  });

  it("persists a toggle", async () => {
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.toggle());
    expect(result.current.collapsed).toBe(true);
    await waitFor(() => expect(writes).toEqual([{ sidebarCollapsed: true }]));
  });

  it("does not let a slow settings read undo a toggle", async () => {
    // The hook renders before the read resolves; a toggle in that window is the
    // newer intent and must survive the answer arriving.
    stored = { ...DEFAULT_SETTINGS, sidebarCollapsed: false };
    const { result } = renderHook(() => useSidebar());
    act(() => result.current.toggle());
    await waitFor(() => expect(writes.length).toBe(1));
    expect(result.current.collapsed).toBe(true);
  });
});
