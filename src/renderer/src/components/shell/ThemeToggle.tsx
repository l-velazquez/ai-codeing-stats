import { MonitorCog, Moon, Sun } from "lucide-react";
import type { ThemePreference } from "../../../../shared/types";
import { nextTheme, THEME_LABELS } from "../../lib/theme";

const ICONS = { dark: Moon, light: Sun, system: MonitorCog } as const;

/**
 * Cycles dark -> light -> system in place. The full three-way control with
 * written labels lives in Data & settings; this is the always-reachable
 * version, which is the point: the theme should not be buried a page deep.
 */
export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: ThemePreference;
  onChange: (theme: ThemePreference) => void;
}) {
  const Icon = ICONS[theme];
  const upcoming = nextTheme(theme);
  return (
    <button
      className="icon-button"
      onClick={() => onChange(upcoming)}
      title={`Theme: ${THEME_LABELS[theme]}. Switch to ${THEME_LABELS[upcoming]}.`}
      aria-label={`Theme: ${THEME_LABELS[theme]}. Switch to ${THEME_LABELS[upcoming]}.`}
    >
      <Icon size={15} />
    </button>
  );
}
