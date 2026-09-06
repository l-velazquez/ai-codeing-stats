import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let isMac = false;

// A getter, so both platforms can be exercised without a second test file:
// the hook reads IS_MAC when the key is pressed, not when it is imported.
vi.mock("@renderer/lib/platform", () => ({
  get IS_MAC() {
    return isMac;
  },
}));

const { useHotkey } = await import("./useHotkey");

function press(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

beforeEach(() => {
  isMac = false;
});

describe("useHotkey", () => {
  it("uses Control where there is no Command key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("b", handler));
    press({ key: "b", ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("uses Command on macOS", () => {
    isMac = true;
    const handler = vi.fn();
    renderHook(() => useHotkey("b", handler));
    press({ key: "b", metaKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("leaves the other platform's modifier alone", () => {
    // Control+B moves the caret back one character in a macOS text field.
    isMac = true;
    const handler = vi.fn();
    renderHook(() => useHotkey("b", handler));
    press({ key: "b", ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores the bare key", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("b", handler));
    press({ key: "b" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("fires once for a held key rather than strobing a toggle", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("b", handler));
    press({ key: "b", ctrlKey: true });
    press({ key: "b", ctrlKey: true, repeat: true });
    press({ key: "b", ctrlKey: true, repeat: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("matches the shifted key too", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey("b", handler));
    press({ key: "B", ctrlKey: true, shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stops listening once unmounted", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useHotkey("b", handler));
    unmount();
    press({ key: "b", ctrlKey: true });
    expect(handler).not.toHaveBeenCalled();
  });
});
