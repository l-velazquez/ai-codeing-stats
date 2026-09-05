import { useEffect } from "react";
import type { SubscriptionUsage } from "@shared/types";
import { readSettings } from "@renderer/lib/bridge";

const FALLBACK_SECONDS = 15;

/**
 * Allowance is the one figure that goes stale while you sit on the page, so it
 * refreshes on its own without a full rescan. Pauses while the window is
 * hidden; there is no point polling a dashboard nobody is looking at.
 */
export function useSubscriptionPoll(apply: (subscriptions: SubscriptionUsage[]) => void): void {
  useEffect(() => {
    if (!window.tokenary) return;
    let interval: number | null = null;
    let stopped = false;

    const tick = () => {
      if (document.visibilityState === "hidden") return;
      void window.tokenary
        ?.subscriptions()
        .then((subscriptions) => {
          if (!stopped) apply(subscriptions);
        })
        .catch(() => {
          // A transient read failure must not replace an otherwise valid dashboard.
        });
    };

    void readSettings()
      .then((settings) => {
        if (stopped) return;
        const seconds = settings.subscriptionPollSeconds || FALLBACK_SECONDS;
        interval = window.setInterval(tick, seconds * 1000);
      })
      .catch(() => {
        if (!stopped) interval = window.setInterval(tick, FALLBACK_SECONDS * 1000);
      });

    return () => {
      stopped = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [apply]);
}
