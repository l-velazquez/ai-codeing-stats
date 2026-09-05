import { RefreshCw } from "lucide-react";
import type { RangeKey, ThemePreference } from "../../../../shared/types";
import { PAGES, type PageId } from "../../app/routes";
import { useRefreshControl } from "../../providers/RefreshProvider";
import { RangeControl } from "./RangeControl";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({
  page,
  range,
  onRangeChange,
  theme,
  onThemeChange,
}: {
  page: PageId;
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const { refresh, busy, available } = useRefreshControl();
  const definition = PAGES[page];

  return (
    <header className="topbar">
      <div className="topbar-title"><strong>{definition.label}</strong></div>

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
