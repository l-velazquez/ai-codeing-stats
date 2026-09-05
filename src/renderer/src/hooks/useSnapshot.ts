import { useCallback, useEffect, useRef, useState } from "react";
import type { RangeKey, StatsSnapshot, SubscriptionUsage } from "@shared/types";
import { scan } from "@renderer/lib/bridge";

export type SnapshotStatus = "loading" | "ready" | "error";

export interface SnapshotState {
  readonly snapshot: StatsSnapshot | null;
  readonly status: SnapshotStatus;
  readonly error: string | null;
  /** True while re-scanning with a previous snapshot still on screen. */
  readonly refreshing: boolean;
  readonly reload: () => void;
  readonly applySubscriptions: (subscriptions: SubscriptionUsage[]) => void;
  readonly setError: (message: string | null) => void;
}

/**
 * An explicit status replaces the old `!snapshot ? <LoadingScreen/>` test.
 * That test could not distinguish "still loading" from "failed with nothing to
 * show", so a failed scan rendered the error banner and a permanently spinning
 * "Reading local usage" panel at the same time, with no way out.
 */
export function useSnapshot(range: RangeKey): SnapshotState {
  const [snapshot, setSnapshot] = useState<StatsSnapshot | null>(null);
  const [status, setStatus] = useState<SnapshotStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (target: RangeKey) => {
    const id = ++requestId.current;
    setRefreshing(true);
    setError(null);
    try {
      const next = await scan(target);
      if (id !== requestId.current) return;
      setSnapshot(next);
      setStatus("ready");
    } catch (reason) {
      if (id !== requestId.current) return;
      setError(reason instanceof Error ? reason.message : "The local scan could not finish.");
      // Keep a previous snapshot on screen if we have one; only a first-load
      // failure leaves the page with nothing to render.
      setStatus((current) => (current === "ready" ? "ready" : "error"));
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const reload = useCallback(() => void load(range), [load, range]);

  const applySubscriptions = useCallback((subscriptions: SubscriptionUsage[]) => {
    setSnapshot((current) => (current ? { ...current, subscriptions } : current));
  }, []);

  return { snapshot, status, error, refreshing, reload, applySubscriptions, setError };
}
