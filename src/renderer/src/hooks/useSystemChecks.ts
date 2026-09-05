import { useCallback, useEffect, useState } from "react";
import type { SystemCheckSnapshot } from "@shared/types";
import { fetchSystemChecks } from "@renderer/lib/bridge";

export function useSystemChecks() {
  const [snapshot, setSnapshot] = useState<SystemCheckSnapshot | null>(null);
  const [checking, setChecking] = useState(false);

  const reload = useCallback(async () => {
    setChecking(true);
    try {
      setSnapshot(await fetchSystemChecks());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { snapshot, checking, reload };
}
