import { Activity, HardDrive, Settings } from "lucide-react";
import type { StatsSnapshot } from "../../../../shared/types";
import { NAVIGATION, PAGES, type PageId } from "../../app/routes";
import { PROVIDERS } from "../../format";

export function Sidebar({
  page,
  onNavigate,
  snapshot,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  snapshot: StatsSnapshot | null;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark"><Activity size={16} /></div>
        <div><strong>Tokenary</strong><span>AI coding telemetry</span></div>
      </div>

      <nav aria-label="Sections">
        <span className="nav-label">Workspace</span>
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
        <span className="nav-label nav-label--second">System</span>
        <button
          className={page === "sources" ? "active" : ""}
          onClick={() => onNavigate("sources")}
          aria-current={page === "sources" ? "page" : undefined}
        >
          <Settings size={16} />
          <span>{PAGES.sources.label}</span>
        </button>
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

      <div className="privacy-pill"><HardDrive size={13} /><span>On-device only</span></div>
    </aside>
  );
}
