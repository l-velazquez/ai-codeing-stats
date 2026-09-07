import { useEffect, useState } from "react";
import { Activity, Pause, Play } from "lucide-react";
import type { ResourceSnapshot } from "@shared/diagnostics";

function bytes(value: number): string {
  return value >= 1024 ** 3 ? `${(value / 1024 ** 3).toFixed(2)} GB` : `${(value / 1024 ** 2).toFixed(1)} MB`;
}
function cpu(value: number | null): string { return value === null ? "Warming up…" : `${value.toFixed(1)}%`; }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="resource-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

export function Diagnostics() {
  const [snapshot, setSnapshot] = useState<ResourceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState<ResourceSnapshot[]>([]);
  useEffect(() => {
    if (paused || !window.tally) return;
    let cancelled = false;
    let busy = false;
    const sample = async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const next = await window.tally!.resources();
        if (!cancelled) {
          setSnapshot(next); setError(null);
          setHistory((items) => [...items, next].slice(-60));
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Resource collection failed.");
      } finally { busy = false; }
    };
    void sample();
    const timer = setInterval(() => void sample(), 1000);
    document.addEventListener("visibilitychange", sample);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", sample); };
  }, [paused]);

  const status = !window.tally ? "Desktop app required" : error ? "Collection failed" : paused ? "Paused" : snapshot ? "Native healthy" : "Connecting…";
  return <div className="diagnostics">
    <div className="resource-heading"><h2><Activity size={19} /> Resource monitor</h2><span className={`resource-status${error ? " resource-status--error" : ""}`}>{status}</span>
      <button className="text-action" disabled={!window.tally} onClick={() => setPaused(!paused)} aria-label={paused ? "Resume monitoring" : "Pause monitoring"}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? "Resume" : "Pause"}</button>
    </div>
    <p className="settings-intro">Live native counters for azul-code’s Electron processes. Samples every second while this view is visible.</p>
    {error ? <p role="alert" className="warning-banner">{error} Retrying automatically. Displayed measurements are from the last successful sample.</p> : null}
    {!window.tally ? <section className="panel settings-card">Open Diagnostics in the desktop app to view real CPU, memory, and host measurements. Native counters are unavailable in the browser preview.</section> : null}
    {snapshot ? <>
      <div className="panel resource-grid">
        <Metric label="Current CPU" value={cpu(snapshot.cpu)} detail="Combined process CPU · 100% = one core" />
        <Metric label="Resident memory" value={bytes(snapshot.memory)} detail="Combined working sets; shared pages may overlap" />
        <Metric label="Process count" value={String(snapshot.processes.length)} detail="Electron-managed app processes" />
        <Metric label="Read / write throughput" value="Unavailable" detail="Not exposed by Electron’s process counters" />
        <Metric label="Thermal state" value={snapshot.host.thermal} detail="Host thermal pressure" />
        <Metric label="Collection time" value={`${snapshot.collectionMs.toFixed(1)} ms`} detail="Native collection wall time · included in backend" />
        {(["Backend", "Desktop", "Helpers"] as const).map((group) => {
          const items = snapshot.processes.filter((item) => item.group === group);
          return <div className="resource-group" key={group}><span>{group}<small>{items.length} processes</small></span><strong>{cpu(snapshot.cpu === null ? null : items.reduce((sum, item) => sum + (item.cpu ?? 0), 0))}</strong><span>{bytes(items.reduce((sum, item) => sum + item.memory, 0))}</span></div>;
        })}
      </div>
      <section className="panel settings-card"><div className="resource-heading"><h3>Recent CPU activity</h3><span>Last {history.length} samples</span></div>
        <div className="resource-history" role="img" aria-label="CPU usage for up to the last 60 samples, scaled to the highest reading">
          {history.map((item, i) => <div key={`${item.sampledAt}-${i}`} title={`${cpu(item.cpu)} · ${bytes(item.memory)}`} style={{ height: `${Math.max(2, (item.cpu ?? 0) / Math.max(1, ...history.map((entry) => entry.cpu ?? 0)) * 100)}%` }} />)}
        </div>
      </section>
      <h2>Host & collection</h2>
      <div className="resource-host">
        <section className="panel settings-card"><h3>Host state</h3><dl>
          <div><dt>Platform</dt><dd>{snapshot.host.platform} · {snapshot.host.arch}</dd></div>
          <div><dt>Logical CPU cores</dt><dd>{snapshot.host.cores}</dd></div>
          <div><dt>Host memory</dt><dd>{bytes(snapshot.host.freeMemory)} free / {bytes(snapshot.host.totalMemory)}</dd></div>
          <div><dt>Power source</dt><dd>{snapshot.host.onBattery ? "Battery" : "External power"}</dd></div>
          <div><dt>Idle</dt><dd>{snapshot.host.idle} · {snapshot.host.idleSeconds}s</dd></div>
        </dl></section>
        <section className="panel settings-card"><h3>Collection health</h3><dl>
          <div><dt>Native collector</dt><dd>{error ? "Error" : paused ? "Paused" : "Healthy"}</dd></div>
          <div><dt>App uptime</dt><dd>{Math.floor(snapshot.host.uptime / 60)}m {Math.floor(snapshot.host.uptime % 60)}s</dd></div>
          <div><dt>Last successful sample</dt><dd>{new Date(snapshot.sampledAt).toLocaleTimeString()}</dd></div>
        </dl><p className="settings-intro">Collection runs inside the main process. External coding agents and short-lived CLI subprocesses are outside this monitor’s scope.</p></section>
      </div>
      <section className="panel settings-card"><h3>Processes</h3><div className="resource-table"><table><thead><tr><th>Process</th><th>PID</th><th>CPU</th><th>Memory</th></tr></thead><tbody>{snapshot.processes.map((item) => <tr key={`${item.pid}-${item.createdAt}`}><td>{item.name}<small>{item.group}</small></td><td>{item.pid}</td><td>{cpu(item.cpu)}</td><td>{bytes(item.memory)}</td></tr>)}</tbody></table></div></section>
    </> : window.tally && !error ? <p role="status">Waiting for native resource counters…</p> : null}
  </div>;
}
