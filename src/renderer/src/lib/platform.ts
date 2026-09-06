/**
 * Shortcut labels and the macOS traffic-light inset are the only things that
 * depend on the host OS, so the answer only has to be good enough to render.
 * The preload bridge reports process.platform; dev:web has no bridge, so fall
 * back to the user agent rather than guessing macOS everywhere.
 */
export const IS_MAC: boolean =
  typeof window !== "undefined" && typeof window.tally?.platform === "string"
    ? window.tally.platform === "darwin"
    : typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** The modifier every shortcut in the app uses: Command on macOS, Control elsewhere. */
export const MOD_SYMBOL = IS_MAC ? "⌘" : "Ctrl";
const MOD_WORD = IS_MAC ? "Command" : "Control";

/** For a title attribute: "⌘B" on macOS, "Ctrl+B" elsewhere. */
export function shortcutLabel(key: string): string {
  return IS_MAC ? `${MOD_SYMBOL}${key.toUpperCase()}` : `${MOD_SYMBOL}+${key.toUpperCase()}`;
}

/**
 * For an aria-label. Screen readers announce "⌘" inconsistently -- often as
 * "place of interest sign" or not at all -- so spell the modifier out.
 */
export function shortcutSpoken(key: string): string {
  return `${MOD_WORD} ${key}`;
}

/**
 * Lets CSS reserve room for the macOS traffic lights, which sit over the top
 * bar once the sidebar that normally clears them is hidden.
 */
export function markPlatform(): void {
  document.documentElement.dataset.platform = IS_MAC ? "mac" : "other";
}
