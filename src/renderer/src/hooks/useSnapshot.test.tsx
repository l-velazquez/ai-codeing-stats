import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RangeKey } from "@shared/types";

/**
 * Backed by a plain function rather than vi.fn(). A spy records the promise it
 * returned and derives a tracking promise from it; when the call rejects, that
 * derived promise has no catch attached and surfaces as an unhandled rejection
 * even though this hook handled the original. Calls are recorded by hand
 * instead, which keeps the failure paths assertable.
 */
let impl: (range: RangeKey) => Promise<unknown> = async () => ({});
const calls: RangeKey[] = [];

vi.mock("@renderer/lib/bridge", () => ({
  scan: (range: RangeKey) => {
    calls.push(range);
    return impl(range);
  },
}));

const { useSnapshot } = await import("./useSnapshot");

function snapshotFixture(cost: number) {
  return { generatedAt: Date.now(), summary: { cost }, subscriptions: [], warnings: [] } as never;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 60));

beforeEach(() => {
  calls.length = 0;
  impl = async () => snapshotFixture(1);
});

describe("useSnapshot", () => {
  it("reaches ready with the scanned snapshot", async () => {
    impl = async () => snapshotFixture(12);
    const { result } = renderHook(() => useSnapshot("30d"));
    await flush();
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("reports a first-load failure as error, never as endless loading", async () => {
    impl = async () => {
      throw new Error("no transcripts");
    };
    const { result } = renderHook(() => useSnapshot("30d"));
    await flush();
    // The old code kept snapshot null and rendered the loading panel forever,
    // with the error banner above it and no way out.
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("no transcripts");
    expect(result.current.snapshot).toBeNull();
  });

  it("retries after a failure", async () => {
    let call = 0;
    impl = async () => {
      if (call++ === 0) throw new Error("boom");
      return snapshotFixture(3);
    };
    const { result } = renderHook(() => useSnapshot("30d"));
    await flush();
    expect(result.current.status).toBe("error");

    act(() => result.current.reload());
    await flush();
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("keeps a good snapshot on screen when a later scan fails", async () => {
    let call = 0;
    impl = async () => {
      if (call++ === 0) return snapshotFixture(5);
      throw new Error("transient");
    };
    const { result } = renderHook(() => useSnapshot("30d"));
    await flush();
    expect(result.current.status).toBe("ready");

    act(() => result.current.reload());
    await flush();
    // A transient failure must not blank a dashboard that is already useful.
    expect(result.current.error).toBe("transient");
    expect(result.current.status).toBe("ready");
    expect(result.current.snapshot).not.toBeNull();
  });

  it("rescans when the range changes", async () => {
    const { rerender } = renderHook(({ range }) => useSnapshot(range), {
      initialProps: { range: "30d" as RangeKey },
    });
    await flush();
    expect(calls).toContain("30d");

    rerender({ range: "7d" });
    await flush();
    expect(calls).toContain("7d");
  });
});
