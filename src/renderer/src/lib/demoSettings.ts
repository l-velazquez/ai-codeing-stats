import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "../../../shared/settings";

const KEY = "tokenary:settings";

/**
 * dev:web has no main process, so preferences live in localStorage there.
 * Same shape and same normalisation as the real store, so the UI cannot tell
 * the difference.
 */
export function readDemoSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeDemoSettings(patch: Partial<Settings>): Settings {
  const next = normalizeSettings({ ...readDemoSettings(), ...patch });
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Non-persistent is acceptable in the browser harness.
  }
  return next;
}
