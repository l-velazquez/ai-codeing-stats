import { Activity, HardDrive, Settings } from "lucide-react";
import type { StatsSnapshot } from "../../../../shared/types";
import { NAVIGATION, PAGES, type PageId } from "../../app/routes";
import { PROVIDERS } from "../../format";

export function Sidebar({
  page,
  onNavigate,
  snapshot,
  onOpenSettings,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  snapshot: StatsSnapshot | null;
  onOpenSettings: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark"><Activity size={16} /></div>
        <div><strong>Tokenary</strong><span>AI coding telemetry</span></div>
      </div>

      <nav aria-label="Sections">
        {NAVIGATION.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => onNavigate(id)}
            aria-current={page === id ? "page" : undefined}
          >
            <Icon size={16} />
            <span>{label}</span>
            {id === "sessions" && snapshot ? <small>{snapshot.sessions.length}</small> : null}
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div className="source-health">
        <span>Local sources</span>
        <div>
          {snapshot?.sources.map((source) => (
            <i
              key={source.provider}
              title={`${source.label}: ${source.state}`}
              className={source.state}
              style={{ "--source": PROVIDERS[source.provider].color } as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      <button className="settings-launcher" onClick={onOpenSettings} aria-label="Settings (Command comma)" title="Settings  ⌘,">
        <Settings size={15} /><span>Settings</span><kbd>⌘,</kbd>
      </button>

      <div className="privacy-pill"><HardDrive size={13} /><span>On-device only</span></div>
    </aside>
  );
}
