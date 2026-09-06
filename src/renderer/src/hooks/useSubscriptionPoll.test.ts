import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useSubscriptionPoll } from "./useSubscriptionPoll";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("refreshes each minute and stops after unmount", async () => {
  vi.useFakeTimers();
  const subscriptions = vi.fn().mockResolvedValue([]);
  vi.stubGlobal("tokenary", { subscriptions });
  const apply = vi.fn();
  const { unmount } = renderHook(() => useSubscriptionPoll(apply));
  await act(() => vi.advanceTimersByTimeAsync(59_999));
  expect(subscriptions).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(subscriptions).toHaveBeenCalledTimes(1);
  expect(apply).toHaveBeenCalledWith([]);
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(subscriptions).toHaveBeenCalledTimes(2);
  unmount();
  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(subscriptions).toHaveBeenCalledTimes(2);
});

it("does not overlap reads or apply results after unmount", async () => {
  vi.useFakeTimers();
  let resolve!: (value: []) => void;
  const subscriptions = vi.fn(() => new Promise<[]>((done) => { resolve = done; }));
  vi.stubGlobal("tokenary", { subscriptions });
  const apply = vi.fn();
  const { unmount } = renderHook(() => useSubscriptionPoll(apply));
  await act(() => vi.advanceTimersByTimeAsync(180_000));
  expect(subscriptions).toHaveBeenCalledTimes(1);
  unmount();
  await act(async () => { resolve([]); });
  expect(apply).not.toHaveBeenCalled();
});
