import { BrandMark } from "../BrandMark";
import { HardDrive, Settings } from "lucide-react";
import type { StatsSnapshot } from "../../../../shared/types";
import { NAVIGATION, PAGES, type PageId } from "../../app/routes";
import { PROVIDERS } from "../../format";
import { shortcutLabel, shortcutSpoken } from "../../lib/platform";

export const SIDEBAR_ID = "app-sidebar";

export function Sidebar({
  page,
  onNavigate,
  snapshot,
  onOpenSettings,
  collapsed,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  snapshot: StatsSnapshot | null;
  onOpenSettings: () => void;
  collapsed: boolean;
}) {
  return (
    // Kept mounted so hiding it can animate, and inert while hidden so neither
    // Tab nor a screen reader can reach a pane that is off screen. The inner
    // wrapper holds the layout width, so the content slides out intact instead
    // of reflowing as the column closes.
    <aside className="sidebar" id={SIDEBAR_ID} inert={collapsed}>
      <div className="sidebar-inner">
        <div className="sidebar-brand">
          <div className="brand-mark"><BrandMark size={29} /></div>
          <div><strong>azul-code</strong><span>AI usage, clearly.</span></div>
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

        <button
          className="settings-launcher"
          onClick={onOpenSettings}
          aria-label={`Settings (${shortcutSpoken("comma")})`}
          title={`Settings  ${shortcutLabel(",")}`}
        >
          <Settings size={15} /><span>Settings</span><kbd>{shortcutLabel(",")}</kbd>
        </button>

        <div className="privacy-pill"><HardDrive size={13} /><span>On-device only</span></div>
      </div>
    </aside>
  );
}
