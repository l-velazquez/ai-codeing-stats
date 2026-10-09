import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@shared/settings";
import type { PricingStatus } from "@shared/types";
import { MODELS_DEV_URL } from "@shared/modelsDev";
import { openUrl, readPricingStatus, readSettings, writeSettings } from "@renderer/lib/bridge";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { relative } from "@renderer/format";

function statusLine(status: PricingStatus | null): string {
  if (status === null) return "Checking price source…";
  if (!status.enabled) return "Using the prices bundled with this version.";
  if (status.source === "bundled") {
    return status.error ? `Using bundled prices: ${status.error}` : "Using bundled prices until the first check finishes.";
  }
  const checked = status.checkedAt === null ? "" : ` Checked ${relative(status.checkedAt) === "now" ? "just now" : `${relative(status.checkedAt)} ago`}.`;
  const failed = status.error ? ` The last check failed (${status.error}); the prices from before stay in use.` : "";
  return `${status.models} models priced from models.dev.${checked}${failed}`;
}

export function PricingSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<PricingStatus | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const loadStatus = () => { void readPricingStatus().then((value) => { if (alive) setStatus(value); }).catch(() => undefined); };
    void readSettings().then((value) => { if (alive) { setSettings(value); setReady(true); } })
      .catch(() => { if (alive) setError("Price settings could not be loaded."); });
    loadStatus();
    const offSettings = window.azulCode?.onSettingsChanged((value) => { if (alive) { setSettings(value); loadStatus(); } });
    // New prices re-aggregate usage, which is announced as a stats change.
    const offStats = window.azulCode?.onStatsChanged(loadStatus);
    return () => { alive = false; offSettings?.(); offStats?.(); };
  }, []);
  async function update(patch: Partial<Settings>) {
    setSaving(true);
    setError(null);
    try { setSettings(await writeSettings(patch)); }
    catch { setError("Price settings could not be saved."); }
    finally { setSaving(false); }
  }
  return <section className="panel settings-card">
    <CardTitle>Model prices</CardTitle>
    <p className="settings-intro">New models and price changes reach your estimates without an app update. azul-code downloads the public <button className="text-action" onClick={() => openUrl(MODELS_DEV_URL)}>models.dev</button> price list; nothing about you or your usage is sent. A price change applies to usage after it is seen, so earlier days keep the price they were billed at.</p>
    <div className="menubar-settings">
      <label><span>Keep model prices up to date</span><input type="checkbox" checked={settings.livePricing} disabled={!ready || saving}
        onChange={(event) => void update({ livePricing: event.target.checked })} /></label>
      <p className="settings-intro">{statusLine(status)}</p>
    </div>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
