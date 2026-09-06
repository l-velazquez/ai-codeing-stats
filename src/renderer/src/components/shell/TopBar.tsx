import { PanelLeftClose, PanelLeftOpen, RefreshCw } from "lucide-react";
import type { RangeKey, ThemePreference } from "../../../../shared/types";
import { PAGES, type PageId } from "../../app/routes";
import { useRefreshControl } from "../../providers/RefreshProvider";
import { shortcutLabel, shortcutSpoken } from "../../lib/platform";
import { RangeControl } from "./RangeControl";
import { SIDEBAR_ID } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({
  page,
  range,
  onRangeChange,
  theme,
  onThemeChange,
  sidebarCollapsed,
  onToggleSidebar,
}: {
  page: PageId;
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const { refresh, busy, available } = useRefreshControl();
  const definition = PAGES[page];

  return (
    <header className="topbar">
      {/* The toggle lives here rather than in the sidebar so it stays reachable
          once the sidebar is gone. no-drag, or the title bar swallows the click. */}
      <div className="topbar-lead">
        <button
          className="icon-button"
          onClick={onToggleSidebar}
          aria-label={`${sidebarCollapsed ? "Show" : "Hide"} sidebar (${shortcutSpoken("B")})`}
          aria-expanded={!sidebarCollapsed}
          aria-controls={SIDEBAR_ID}
          title={`${sidebarCollapsed ? "Show" : "Hide"} sidebar  ${shortcutLabel("b")}`}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
        <div className="topbar-title"><strong>{definition.label}</strong></div>
      </div>

      {/* Everything interactive must stay inside .topbar-actions, which carries
          -webkit-app-region: no-drag. The bar itself is a drag region, and a
          control placed outside this container becomes unclickable. */}
      <div className="topbar-actions">
        {/* Rendered only where it changes something. Contributions has its own
            month cursor and Data & settings has no time dimension at all, so
            showing a range control there was a no-op the user could not tell
            apart from a broken one. */}
        {definition.supportsRange ? <RangeControl range={range} onChange={onRangeChange} /> : null}

        {available ? (
          <button
            className="icon-button"
            onClick={refresh}
            title={`Refresh ${definition.label.toLowerCase()}`}
            aria-label={`Refresh ${definition.label.toLowerCase()}`}
            disabled={busy}
          >
            <RefreshCw size={15} className={busy ? "spin" : ""} />
          </button>
        ) : null}

        <ThemeToggle theme={theme} onChange={onThemeChange} />
      </div>
    </header>
  );
}
