import { BrandMark } from "@renderer/components/BrandMark";
import { useThemePreference } from "@renderer/hooks/useThemePreference";
import { useEffect, useState } from "react";
import { ArrowUpRight, RefreshCw, Settings2 } from "lucide-react";
import { windowAfterReset } from "@shared/allowance";
import { allowanceIsStale, localDayKey, remainingPercent, type MenuBarState } from "@shared/menuBar";
import type { SubscriptionUsage } from "@shared/types";
import { ProviderMark } from "@renderer/components/ProviderMark";
import { compact, dateTime, money, PROVIDERS, relative } from "@renderer/format";
import { pressureOf, resetText } from "@renderer/lib/allowance";
import { IS_ELECTRON, missingBridgeError } from "@renderer/lib/bridge";
import { demoSnapshot } from "@renderer/demo";
import { demoState } from "@renderer/lib/demoState";
import { usePanelHeight } from "@renderer/hooks/usePanelHeight";

function demoMenuBar(): MenuBarState {
  if (demoState() === "error") return { summary: null, refreshing: false, error: "Local usage could not be read. Try refreshing." };
  const data = demoSnapshot("7d");
  const day = data.daily.find((point) => point.date === localDayKey());
  return { refreshing: false, error: null, summary: {
    day: localDayKey(), updatedAt: Date.now(), cost: day?.cost ?? 0, tokens: day?.tokens ?? 0,
    pricedPercent: data.summary.pricedPercent,
    providers: data.providers.map((provider) => ({ ...provider, cost: day?.byProvider[provider.provider] ?? 0 })),
    sources: data.sources, subscriptions: data.subscriptions,
  } };
}

function Allowance({ usage, now }: { usage: SubscriptionUsage; now: number }) {
  return <div className="menubar-allowance">
    <div className="menubar-provider-name"><ProviderMark provider={usage.provider} /><strong>{PROVIDERS[usage.provider].label}</strong>
      {usage.updatedAt ? <span title={dateTime(usage.updatedAt)}>Reported {relative(usage.updatedAt)}{relative(usage.updatedAt) === "now" ? "" : " ago"}</span> : null}</div>
    {usage.state === "live" && usage.windows.length ? <div className="menubar-windows">{usage.windows.map((window, index) => {
      const stale = allowanceIsStale(usage, window, now);
      const reset = window.resetsAt <= now;
      const current = windowAfterReset(window, now);
      const remaining = remainingPercent(window, now);
      const status = reset
        ? "Reset due · bar reset automatically"
        : stale
          ? `Last report · ${resetText(window.resetsAt, now)}`
          : resetText(window.resetsAt, now);
      return <div className="menubar-meter" data-pressure={pressureOf(current.usedPercent)} data-stale={stale} key={`${window.windowMinutes}-${index}`}>
        <div><span>{window.label}</span><strong>{remaining}% left</strong></div>
        <div className="menubar-track" role="progressbar" aria-label={`${PROVIDERS[usage.provider].label} ${window.label} remaining`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={remaining}
          aria-valuetext={`${remaining}% remaining. ${reset ? "The allowance reset at the known reset time." : stale ? "Showing the last provider report." : resetText(window.resetsAt, now)}`}>
          <i style={{ width: `${remaining}%` }} />
        </div>
        <small>{status}</small>
      </div>;
    })}</div> : <p className="menubar-unavailable">{usage.capture?.state === "waiting" ? "Waiting for the next Claude Code response." : "Allowance unavailable. Open azul-code to connect."}</p>}
  </div>;
}

export function MenuBarView({ state, now, onRefresh, onOpen, onSettings, onQuit }: {
  state: MenuBarState; now: number; onRefresh: () => void; onOpen: () => void; onSettings: () => void; onQuit: () => void;
}) {
  const summary = state.summary;
  const today = summary?.day === localDayKey(now);
  const available = !!summary?.sources.some((source) => source.state === "connected");
  const partial = !!summary && (summary.pricedPercent < 1 || summary.sources.some((source) => source.state === "error"));
  const stale = !!summary && (now - summary.updatedAt > 120_000 || !!state.error);
  const panel = usePanelHeight(IS_ELECTRON);
  return <div className="menubar-app">
    <header className="menubar-header" ref={panel.header}><div><BrandMark size={22} /><strong>azul-code</strong></div>
      <div><button onClick={onRefresh} disabled={state.refreshing} aria-label="Refresh usage" title="Refresh usage"><RefreshCw size={15} className={state.refreshing ? "spin" : ""} /></button>
        <button onClick={onSettings} aria-label="Open settings" title="Settings"><Settings2 size={15} /></button></div></header>
    <main className="menubar-content">
      {/* Padding lives on this wrapper, not the scroller, so its height is exactly
          what the window should be. See menubar.css. */}
      <div className="menubar-measure" ref={panel.measure}>
      <section className="menubar-today" aria-label="Today's usage">
        <div className="menubar-eyebrow"><span>Today</span><span>{new Date(now).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
        <div className="menubar-cost">{summary && today && available ? money(summary.cost) : "—"}</div>
        <div className="menubar-cost-label">API equivalent <span>USD{partial ? " · partially priced" : ""}</span></div>
        <div className="menubar-token-total"><span>Tokens</span><strong>{summary && today && available ? compact(summary.tokens) : "—"}</strong></div>
        <p>Estimated API value · not your subscription bill</p>
      </section>
      {state.error ? <p className="menubar-notice" role="alert">{state.error} {summary ? "Showing the last available scan." : "Use Refresh to try again."}</p> : null}
      {!summary && !state.error ? <p className="menubar-unavailable" role="status">Reading local usage…</p> : null}
      {summary && !today ? <p className="menubar-notice" role="status">A new day has started. Waiting for today's scan.</p> : null}
      {summary && !available ? <p className="menubar-notice">No usage sources connected. Open azul-code to check your setup.</p> : null}
      {summary ? <section className="menubar-providers" aria-label="Today's provider breakdown">
        {summary.sources.map((source) => {
          const provider = summary.providers.find((item) => item.provider === source.provider);
          return <div className="menubar-provider-row" key={source.provider}>
            <ProviderMark provider={source.provider} /><span>{PROVIDERS[source.provider].label}</span>
            <strong>{source.state === "connected" && today ? money(provider?.cost ?? 0) : "—"}</strong>
            <small>{source.state === "connected" ? "" : source.state === "error" ? "Read error" : "Not connected"}</small>
          </div>;
        })}
        {partial ? <p className="menubar-notice">Some activity could not be priced or read. The estimate may be incomplete.</p> : null}
      </section> : null}
      {summary ? <section className="menubar-subscriptions" aria-label="Subscription allowance">
        <h2>Allowance remaining</h2>
        {summary.subscriptions.map((usage) => <Allowance key={usage.provider} usage={usage} now={now} />)}
      </section> : null}
      </div>
    </main>
    <footer className="menubar-footer" ref={panel.footer}>
      <div className="menubar-update" role="status"><i data-stale={stale} />{state.refreshing ? "Refreshing…" : summary ? `${stale ? "Stale · last scan" : "Scanned"} ${relative(summary.updatedAt)}${relative(summary.updatedAt) === "now" ? "" : " ago"}` : "Waiting for usage"}</div>
      <div><button className="menubar-open" onClick={onOpen}>Open azul-code <ArrowUpRight size={14} /></button><button onClick={onQuit}>Quit</button></div>
    </footer>
  </div>;
}

export default function MenuBarApp() {
  const [state, setState] = useState<MenuBarState>({ summary: null, refreshing: true, error: null });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true;
    let received = false;
    const apply = (value: MenuBarState) => { if (active) setState(value); };
    const bridge = window.azulCode?.menuBar;
    const unsubscribe = bridge?.onChange((value) => { received = true; apply(value); });
    if (bridge) void bridge.get().then((value) => { if (!received) apply(value); })
      .catch(() => apply({ summary: null, refreshing: false, error: "azul-code could not load usage. Try refreshing." }));
    else apply(IS_ELECTRON ? { summary: null, refreshing: false, error: missingBridgeError().message } : demoMenuBar());
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => { active = false; unsubscribe?.(); window.clearInterval(timer); };
  }, []);
  useThemePreference();
  const refresh = () => {
    if (!window.azulCode) { if (!IS_ELECTRON) setState(demoMenuBar()); return; }
    void window.azulCode.menuBar.refresh().catch(() => setState((previous) => ({ ...previous, refreshing: false, error: "Refresh failed. Please try again." })));
  };
  return <MenuBarView state={state} now={now} onRefresh={refresh}
    onOpen={() => { void window.azulCode?.menuBar.openDashboard(); }}
    onSettings={() => { void window.azulCode?.menuBar.openDashboard(true); }}
    onQuit={() => { void window.azulCode?.menuBar.quit(); }} />;
}
