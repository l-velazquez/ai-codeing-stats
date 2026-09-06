import { useEffect } from "react";
import type { SubscriptionUsage } from "@shared/types";

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Allowance is the one figure that goes stale while you sit on the page, so it
 * refreshes on its own without a full rescan. Pauses while the window is
 * hidden; there is no point polling a dashboard nobody is looking at.
 */
export function useSubscriptionPoll(apply: (subscriptions: SubscriptionUsage[]) => void): void {
  useEffect(() => {
    if (!window.tokenary) return;
    let stopped = false;
    let pending = false;

    const tick = () => {
      if (document.visibilityState === "hidden" || pending) return;
      pending = true;
      void window.tokenary
        ?.subscriptions()
        .then((subscriptions) => {
          if (!stopped) apply(subscriptions);
        })
        .catch(() => {
          // A transient read failure must not replace an otherwise valid dashboard.
        })
        .finally(() => { pending = false; });
    };

    const interval = window.setInterval(tick, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [apply]);
}
