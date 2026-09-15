import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@shared/settings";
import { readSettings, writeSettings } from "@renderer/lib/bridge";
import { CardTitle } from "@renderer/components/primitives/CardTitle";

export function MenuBarSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void readSettings().then((value) => { if (alive) { setSettings(value); setReady(true); } })
      .catch(() => { if (alive) setError("Menu bar settings could not be loaded."); });
    const unsubscribe = window.azulCode?.onSettingsChanged((value) => { if (alive) setSettings(value); });
    return () => { alive = false; unsubscribe?.(); };
  }, []);
  async function update(patch: Partial<Settings>) {
    setSaving(true);
    setError(null);
    try { setSettings(await writeSettings(patch)); }
    catch { setError("Menu bar settings could not be saved."); }
    finally { setSaving(false); }
  }
  const disabled = !ready || saving;
  return <section className="panel settings-card">
    <CardTitle>Menu bar</CardTitle>
    <p className="settings-intro">Keep usage a glance away. Updates every minute, even with the dashboard closed.</p>
    <div className="menubar-settings">
      <label><span>Show azul-code in the menu bar</span><input type="checkbox" checked={settings.menuBarEnabled} disabled={disabled}
        onChange={(event) => void update({ menuBarEnabled: event.target.checked })} /></label>
      <label><span>Display</span><select value={settings.menuBarDisplay} disabled={disabled || !settings.menuBarEnabled}
        onChange={(event) => void update({ menuBarDisplay: event.target.value as Settings["menuBarDisplay"] })}>
        <option value="cost">Today's API equivalent</option><option value="allowance">Remaining allowance</option>
        <option value="both">Cost and allowance</option><option value="icon">Icon only</option>
      </select></label>
      {settings.menuBarDisplay === "allowance" || settings.menuBarDisplay === "both" ? <>
        <label><span>Allowance provider</span><select value={settings.menuBarProvider} disabled={disabled || !settings.menuBarEnabled}
          onChange={(event) => void update({ menuBarProvider: event.target.value as Settings["menuBarProvider"] })}>
          <option value="codex">Codex</option><option value="claude">Claude Code</option>
        </select></label>
        <label><span>Allowance window</span><select value={settings.menuBarWindow} disabled={disabled || !settings.menuBarEnabled}
          onChange={(event) => void update({ menuBarWindow: event.target.value as Settings["menuBarWindow"] })}>
          <option value="session">Short window</option><option value="weekly">Weekly</option>
        </select></label>
        <p className="settings-intro">Cx = Codex · Cl = Claude Code. Percentages show allowance remaining. Stale or unavailable readings appear as —.</p>
      </> : null}
    </div>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
