/**
 * dev:web state switch.
 *
 * The demo generators only ever produced the happy path, so the screens that
 * most need design attention -- a fresh install with no allowance connected, an
 * unauthenticated GitHub, zero recorded usage, a failed scan -- could not be
 * reached in the browser harness at all. Select one with ?state=... on the
 * dev server, e.g. http://localhost:4317/?state=fresh
 */
export type DemoState = "live" | "fresh" | "waiting" | "empty" | "error";

const STATES: readonly DemoState[] = ["live", "fresh", "waiting", "empty", "error"];

export function demoState(): DemoState {
  if (typeof window === "undefined") return "live";
  const value = new URLSearchParams(window.location.search).get("state");
  return STATES.includes(value as DemoState) ? (value as DemoState) : "live";
}

export const DEMO_STATE_LABELS: Record<DemoState, string> = {
  live: "Everything connected",
  fresh: "Fresh install, nothing connected",
  waiting: "Status line installed, awaiting first response",
  empty: "Connected but no recorded usage",
  error: "Scan and GitHub both failing",
};
