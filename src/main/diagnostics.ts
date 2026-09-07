import { app, powerMonitor } from "electron";
import { cpus, totalmem, freemem } from "node:os";
import { performance } from "node:perf_hooks";
import type { ResourceSnapshot } from "../shared/diagnostics";

let previousSample = 0;
let cached: ResourceSnapshot | null = null;

/** Pull-only collection: no background timer or additional monitor process. */
export function collectResources(): ResourceSnapshot {
  const started = performance.now();
  if (cached && started - previousSample < 750) return cached;
  const warm = previousSample > 0 && started - previousSample < 2500;
  const processes = app.getAppMetrics().map((metric) => ({
    pid: metric.pid,
    createdAt: metric.creationTime,
    name: metric.name || (metric.type === "Browser" ? "Main process" : metric.type === "Tab" ? "Renderer" : metric.type),
    group: (metric.type === "Browser" ? "Backend" : metric.type === "Tab" || metric.type === "GPU" ? "Desktop" : "Helpers") as "Backend" | "Desktop" | "Helpers",
    cpu: warm ? metric.cpu.percentCPUUsage : null,
    memory: metric.memory.workingSetSize * 1024,
  }));
  const host = {
    platform: process.platform, arch: process.arch, cores: cpus().length,
    totalMemory: totalmem(), freeMemory: freemem(), uptime: process.uptime(),
    onBattery: powerMonitor.isOnBatteryPower(),
    thermal: process.platform === "darwin" ? powerMonitor.getCurrentThermalState() : "unknown",
    idle: powerMonitor.getSystemIdleState(60), idleSeconds: powerMonitor.getSystemIdleTime(),
  };
  cached = {
    sampledAt: Date.now(), processes,
    cpu: warm ? processes.reduce((sum, item) => sum + (item.cpu ?? 0), 0) : null,
    memory: processes.reduce((sum, item) => sum + item.memory, 0),
    host, collectionMs: performance.now() - started,
  };
  previousSample = started;
  return cached;
}
