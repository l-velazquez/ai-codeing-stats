import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "./useCopyToClipboard";

let write: (text: string) => Promise<void>;

beforeEach(() => {
  vi.useFakeTimers();
  write = async () => {};
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: (text: string) => write(text) },
  });
});

afterEach(() => vi.useRealTimers());

describe("useCopyToClipboard", () => {
  it("reports success for the target that was copied", async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => void (await result.current.copy("text", "2026-09-01")));
    expect(result.current.stateFor("2026-09-01")).toBe("copied");
    expect(result.current.stateFor("2026-09-02")).toBe("idle");
  });

  it("reports failure instead of swallowing it", async () => {
    write = async () => {
      throw new Error("denied");
    };
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => void (await result.current.copy("text", "month")));
    // The old helper caught and returned, so a blocked clipboard looked exactly
    // like a click that did nothing.
    expect(result.current.stateFor("month")).toBe("failed");
  });

  it("returns to idle after the confirmation window", async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => void (await result.current.copy("text", "month")));
    expect(result.current.stateFor("month")).toBe("copied");
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.stateFor("month")).toBe("idle");
  });
});
