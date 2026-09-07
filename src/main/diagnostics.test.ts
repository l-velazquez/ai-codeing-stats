import { beforeEach, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ metrics: vi.fn(), clock: 1000 }));
vi.mock("electron", () => ({
  app: { getAppMetrics: native.metrics },
  powerMonitor: { isOnBatteryPower: () => false, getCurrentThermalState: () => "nominal", getSystemIdleState: () => "active", getSystemIdleTime: () => 0 },
}));
vi.mock("node:perf_hooks", () => ({ performance: { now: () => native.clock } }));
beforeEach(() => {
  vi.resetModules(); native.clock = 1000;
  native.metrics.mockReset().mockReturnValue([
    { pid: 1, creationTime: 1, type: "Browser", cpu: { percentCPUUsage: 12 }, memory: { workingSetSize: 2048 } },
    { pid: 2, creationTime: 2, type: "Tab", cpu: { percentCPUUsage: 8 }, memory: { workingSetSize: 1024 } },
  ]);
});
it("warms up CPU, converts KB to bytes, groups processes and totals native readings", async () => {
  const { collectResources } = await import("./diagnostics");
  expect(collectResources()).toMatchObject({ cpu: null, memory: 3 * 1024 ** 2 });
  native.clock += 1000;
  const next = collectResources();
  expect(next.cpu).toBe(20);
  expect(next.processes.map((p) => p.group)).toEqual(["Backend", "Desktop"]);
});
it("shares recent samples and warms up again after a collection gap", async () => {
  const { collectResources } = await import("./diagnostics");
  const first = collectResources(); native.clock += 100;
  expect(collectResources()).toBe(first);
  expect(native.metrics).toHaveBeenCalledTimes(1);
  native.clock += 3000;
  expect(collectResources().cpu).toBeNull();
});
