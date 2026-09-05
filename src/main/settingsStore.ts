import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { app, screen } from "electron";
import type { Rectangle } from "electron";
import { DEFAULT_SETTINGS, normalizeSettings, type Settings, type WindowBounds } from "../shared/settings";

let cached: Settings | null = null;
let settingsPath: string | null = null;

function resolvePath(): string {
  if (settingsPath === null) settingsPath = join(app.getPath("userData"), "settings.json");
  return settingsPath;
}

/** Test seam: point the store at a temp file and clear the memo. */
export function __setSettingsPathForTests(path: string | null): void {
  settingsPath = path;
  cached = null;
}

/**
 * Synchronous by design: main needs the theme before the BrowserWindow is
 * constructed, to choose backgroundColor and nativeTheme.themeSource. An async
 * read would mean painting the window before the answer arrived.
 */
export function readSettings(): Settings {
  if (cached !== null) return cached;
  try {
    cached = normalizeSettings(JSON.parse(readFileSync(resolvePath(), "utf8")));
  } catch {
    // Missing, unreadable, or corrupt: fall back rather than block startup.
    cached = DEFAULT_SETTINGS;
  }
  return cached;
}

function persist(settings: Settings): void {
  const target = resolvePath();
  try {
    mkdirSync(dirname(target), { recursive: true });
    // Write-then-rename so a crash mid-write cannot leave a truncated file that
    // would silently reset every preference on the next launch.
    const temporary = `${target}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    renameSync(temporary, target);
  } catch {
    // Preferences are best-effort; failing to save must never crash the app.
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const next = normalizeSettings({ ...readSettings(), ...patch });
  cached = next;
  persist(next);
  return next;
}

/**
 * A restored position can point at a display that no longer exists. Keep the
 * size, but drop the position unless it still intersects some work area.
 */
export function usableBounds(bounds: WindowBounds | null): WindowBounds | null {
  if (bounds === null) return null;
  if (bounds.x === undefined || bounds.y === undefined) return bounds;

  const rect: Rectangle = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      rect.x < area.x + area.width &&
      rect.x + rect.width > area.x &&
      rect.y < area.y + area.height &&
      rect.y + rect.height > area.y
    );
  });

  return visible ? bounds : { width: bounds.width, height: bounds.height };
}
