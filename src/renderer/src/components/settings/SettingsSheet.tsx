import { useState } from "react";
import { Diagnostics } from "./Diagnostics";
import { ACCENT_COLORS, type AccentColor } from "@shared/settings";
import { BrandMark } from "@renderer/components/BrandMark";
import { ArrowUpRight, ChevronRight, CircleDollarSign, Database, HardDrive, Info, MonitorCog, Moon, RefreshCw, Sun } from "lucide-react";
import type { StatsSnapshot, ThemePreference } from "@shared/types";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { Modal } from "@renderer/components/primitives/Modal";
import { ProviderMark } from "@renderer/components/ProviderMark";
import { SystemCheckIcon } from "@renderer/components/settings/SystemCheckIcon";
import { useSystemChecks } from "@renderer/hooks/useSystemChecks";
import { openPath, openUrl } from "@renderer/lib/bridge";
import { MenuBarSettings } from "./MenuBarSettings";

type AppearanceProps = { theme: ThemePreference; setTheme: (theme: ThemePreference) => void; accent: AccentColor; setAccent: (accent: AccentColor) => void };

function SettingsBody({ snapshot, theme, setTheme, accent, setAccent }: { snapshot: StatsSnapshot } & AppearanceProps) {
  const { snapshot: system, checking: checkingSystem, reload: loadSystemChecks } = useSystemChecks();

  return (
    <div className="settings-layout">
      <section className="panel settings-card appearance-card">
        <div className="appearance-mode"><div><CardTitle>Appearance</CardTitle><p className="settings-intro">Choose your mode and accent. The Dock icon always stays azul blue.</p></div>
        <div className="theme-toggle">
          <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}><Moon size={15} /> Dark</button>
          <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} aria-pressed={theme === "light"}><Sun size={15} /> Light</button>
          <button className={theme === "system" ? "active" : ""} onClick={() => setTheme("system")} aria-pressed={theme === "system"}><MonitorCog size={15} /> System</button>
        </div>
        </div>
        <div className="accent-heading"><strong>Color theme</strong><span>Charts, highlights, and your app mark</span></div>
        <div className="accent-options" role="group" aria-label="Color theme">
          {ACCENT_COLORS.map((color) => <button key={color} className="accent-option" data-accent={color} aria-pressed={accent === color} onClick={() => setAccent(color)}>
            <span className="accent-swatch"><BrandMark size={27} /></span>
            <span>{color}</span>
          </button>)}
        </div>
      </section>
      {(!window.azulCode || window.azulCode.platform === "darwin") ? <MenuBarSettings /> : null}
      <section className="panel settings-card">
        <div className="settings-section-head">
          <div><CardTitle>System check</CardTitle><p className="settings-intro">See what this Mac has installed and what still needs attention. azul-code never installs command-line tools without you.</p></div>
        </div>
        <div className="system-check-list">
          {system?.checks.map((check) => (
            <div className="system-check-row" key={check.id}>
              <SystemCheckIcon check={check} />
              <div className="system-check-name"><strong>{check.label}</strong><span>{check.version ?? check.command}</span></div>
              <div className="system-check-detail"><span className={`status-dot system-dot--${check.state}`} /><strong>{check.state === "ready" ? "Ready" : check.state === "action" ? "Action needed" : check.id === "git" ? "Optional" : "Not found"}</strong><small>{check.detail}</small></div>
              <button className="text-action system-check-help" onClick={() => openUrl(check.helpUrl)}>{check.state === "ready" ? "Docs" : check.state === "action" ? "Set up" : "Install"}<ArrowUpRight size={11} /></button>
            </div>
          )) ?? <div className="system-check-loading"><RefreshCw className="spin" size={13} /> Checking this Mac…</div>}
        </div>
        <div className="estimate-callout"><Info size={16} /><span>Contributions needs GitHub access, not the Git executable itself. Use an authenticated <strong>gh</strong> CLI or launch azul-code with <strong>GH_TOKEN</strong>. Git is shown because it is useful for local development.</span></div>
      </section>
      <section className="panel settings-card">
        <CardTitle>Data sources</CardTitle>
        <p className="settings-intro">azul-code reads usage metadata directly from the coding agents already installed on this Mac. Prompt text and tool output never enter the dashboard.</p>
        <div className="source-list">
          {snapshot.sources.map((source) => (
            <button className="source-row" key={source.provider} onClick={() => openPath(source.path)} disabled={!window.azulCode}>
              <ProviderMark provider={source.provider} />
              <div><strong>{source.label}</strong><span>{source.path}</span></div>
              <div className="source-detail"><span className={`status-dot status-dot--${source.state}`} /> <strong>{source.state}</strong><small>{source.detail}</small></div>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      </section>
      <section className="panel settings-card">
        <CardTitle>Estimate method</CardTitle>
        <div className="method-grid">
          <div><div className="method-icon"><Database size={17} /></div><strong>Usage metadata</strong><p>Input, cache read/write, output, and reasoning counts come from local provider transcripts.</p></div>
          <div><div className="method-icon"><CircleDollarSign size={17} /></div><strong>List prices</strong><p>Known models use standard public API token prices. Provider-reported cost wins when present.</p></div>
          <div><div className="method-icon"><HardDrive size={17} /></div><strong>On-device</strong><p>No account link, API key, analytics endpoint, or cloud database is required.</p></div>
        </div>
        <div className="estimate-callout"><Info size={16} /><span>These are “what this would cost through the API” estimates. They are not your ChatGPT, Claude, or Cursor subscription bill.</span></div>
      </section>

    </div>
  );
}

export function SettingsSheet({
  snapshot,
  theme,
  setTheme,
  accent,
  setAccent,
  onClose,
}: {
  snapshot: StatsSnapshot;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  onClose: () => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
}) {
  const [tab, setTab] = useState<"general" | "diagnostics">("general");
  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        <button role="tab" aria-selected={tab === "general"} onClick={() => setTab("general")}>General</button>
        <button role="tab" aria-selected={tab === "diagnostics"} onClick={() => setTab("diagnostics")}>Diagnostics</button>
      </div>
      {tab === "general" ? <SettingsBody snapshot={snapshot} theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} /> : <Diagnostics />}
    </Modal>
  );
}
