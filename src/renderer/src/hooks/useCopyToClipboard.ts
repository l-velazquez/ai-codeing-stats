import { useCallback, useEffect, useRef, useState } from "react";

export type CopyState = "idle" | "copied" | "failed";

const RESET_MS = 1800;

/**
 * Reports failure instead of swallowing it. The previous helper caught the
 * rejection and returned, so a blocked clipboard was indistinguishable from a
 * click that did nothing at all.
 */
export function useCopyToClipboard() {
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const copy = useCallback(async (text: string, target: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    setKey(target);
    timer.current = window.setTimeout(() => {
      setState("idle");
      setKey(null);
      timer.current = null;
    }, RESET_MS);
  }, []);

  const stateFor = useCallback(
    (target: string): CopyState => (key === target ? state : "idle"),
    [key, state],
  );

  return { copy, stateFor };
}
