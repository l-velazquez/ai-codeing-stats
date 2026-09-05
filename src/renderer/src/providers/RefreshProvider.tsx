import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

type RefreshHandler = () => void | Promise<void>;

interface Registration {
  readonly handler: RefreshHandler;
  readonly busy: boolean;
}

interface RefreshContextValue {
  refresh: () => void;
  busy: boolean;
  /** False when nothing has claimed the control, so the shell can hide it. */
  available: boolean;
  setDefault: (registration: Registration | null) => void;
  setOverride: (key: string, registration: Registration | null) => void;
}

const RefreshContext = createContext<RefreshContextValue | null>(null);

/**
 * The top bar owns one refresh control, but what it should do depends on the
 * page: rescan local usage on the analytics pages, refetch the month on
 * Contributions, re-run system checks on Data & settings. Previously the button
 * always rescanned, which made it a silent no-op on the two pages that own
 * their data -- and Contributions ended up showing a second, competing refresh
 * button of its own.
 *
 * A page registers an override for as long as it is mounted; the shell
 * registers the fallback. Overrides win, and because they are keyed rather than
 * stored in a single slot, a page mounting or unmounting cannot clobber the
 * shell's registration through effect ordering.
 */
export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const fallback = useRef<Registration | null>(null);
  const overrides = useRef(new Map<string, Registration>());
  const [, bump] = useState(0);

  const rerender = useCallback(() => bump((value) => value + 1), []);

  const setDefault = useCallback((registration: Registration | null) => {
    fallback.current = registration;
    rerender();
  }, [rerender]);

  const setOverride = useCallback((key: string, registration: Registration | null) => {
    if (registration === null) overrides.current.delete(key);
    else overrides.current.set(key, registration);
    rerender();
  }, [rerender]);

  const active = [...overrides.current.values()].at(-1) ?? fallback.current;

  const refresh = useCallback(() => {
    const current = [...overrides.current.values()].at(-1) ?? fallback.current;
    if (current === null) return;
    void current.handler();
  }, []);

  const value = useMemo<RefreshContextValue>(
    () => ({
      refresh,
      busy: active?.busy ?? false,
      available: active !== null,
      setDefault,
      setOverride,
    }),
    [refresh, active, setDefault, setOverride],
  );

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>;
}

export function useRefreshControl(): RefreshContextValue {
  const value = useContext(RefreshContext);
  if (value === null) throw new Error("useRefreshControl must be used inside a RefreshProvider.");
  return value;
}

/** Used by the shell for the pages that simply rescan local usage. */
export function useDefaultRefresh(handler: RefreshHandler, busy: boolean): void {
  const { setDefault } = useRefreshControl();
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    setDefault({ handler: () => latest.current(), busy });
    return () => setDefault(null);
  }, [setDefault, busy]);
}

/** Used by a page that owns its own data and must refresh that instead. */
export function useRegisterRefresh(handler: RefreshHandler, busy: boolean): void {
  const key = useId();
  const { setOverride } = useRefreshControl();
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    setOverride(key, { handler: () => latest.current(), busy });
    return () => setOverride(key, null);
  }, [key, setOverride, busy]);
}
