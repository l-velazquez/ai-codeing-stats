import { afterEach, expect, it, vi } from "vitest";
import { StatsService } from "./statsService";
import type { StatsSnapshot } from "../shared/types";

const snapshot = () => ({ generatedAt: Date.now(), summary: { cost: 12, totalTokens: 1000, pricedPercent: 1 },
  providers: [], sources: [], subscriptions: [] }) as unknown as StatsSnapshot;

afterEach(() => vi.useRealTimers());

it("coalesces simultaneous panel, dashboard and refresh requests into one scan", async () => {
  let release!: () => void;
  const refresh = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
  const read = vi.fn(snapshot);
  const service = new StatsService({ refresh, read });
  const events = vi.fn();
  service.subscribe(events);
  const first = service.refresh();
  expect(service.refresh()).toBe(first);
  const dashboard = service.read("30d");
  await Promise.resolve();
  expect(refresh).toHaveBeenCalledTimes(1);
  release();
  await Promise.all([first, dashboard]);
  expect(service.getState().refreshing).toBe(false);
  expect(service.getState().summary?.cost).toBe(12);
  expect(events.mock.calls.filter((call) => call[1] === true)).toHaveLength(1);
  await service.read("all");
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("retains previous values on failure and recovers on the next refresh", async () => {
  let fail = false;
  const service = new StatsService({ refresh: async () => { if (fail) throw new Error("disk unavailable"); }, read: snapshot });
  await service.refresh();
  const summary = service.getState().summary;
  fail = true;
  await service.refresh();
  expect(service.getState()).toMatchObject({ summary, refreshing: false, error: "disk unavailable" });
  await expect(service.read("7d")).rejects.toThrow("disk unavailable");
  fail = false;
  await service.refresh();
  expect(service.getState().error).toBeNull();
});

it("refreshes without a renderer, at local midnight, and stops cleanly", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 5, 23, 59, 40));
  const refresh = vi.fn(async () => {});
  const service = new StatsService({ refresh, read: snapshot });
  service.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(refresh).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(20_000);
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(service.getState().summary?.day).toBe("2026-09-06");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(3);
  service.stop();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(refresh).toHaveBeenCalledTimes(3);
  service.start();
  await vi.advanceTimersByTimeAsync(0);
  expect(refresh).toHaveBeenCalledTimes(4);
  service.stop();
});

it("does not restart a timer when stopped during an in-flight scan", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const service = new StatsService({ refresh: () => new Promise<void>((resolve) => { release = resolve; }), read: snapshot });
  service.start();
  await Promise.resolve();
  service.stop();
  release();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(0);
});
