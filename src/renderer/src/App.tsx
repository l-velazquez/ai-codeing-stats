import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Info } from "lucide-react";
import type { RangeKey } from "@shared/types";
import { useThemePreference } from "@renderer/hooks/useThemePreference";
import { PAGES, type PageId } from "@renderer/app/routes";
import { Sidebar } from "@renderer/components/shell/Sidebar";
import { TopBar } from "@renderer/components/shell/TopBar";
import { ErrorState } from "@renderer/components/primitives/ErrorState";
import { LoadingScreen } from "@renderer/components/primitives/LoadingScreen";
import { useSnapshot } from "@renderer/hooks/useSnapshot";
import { useGithubMonth } from "@renderer/hooks/useGithubMonth";
import { useDailyCostIndex } from "@renderer/hooks/useDailyCostIndex";
import { useHotkey } from "@renderer/hooks/useHotkey";
import { useSidebar } from "@renderer/hooks/useSidebar";
import { useDayOrder } from "@renderer/hooks/useDayOrder";
import { useSubscriptionPoll } from "@renderer/hooks/useSubscriptionPoll";
import { RefreshProvider, useDefaultRefresh } from "@renderer/providers/RefreshProvider";
import { OverviewPage } from "@renderer/pages/OverviewPage";
import { PlansPage } from "@renderer/pages/PlansPage";
import { ModelsPage } from "@renderer/pages/ModelsPage";
import { ProjectsPage } from "@renderer/pages/ProjectsPage";
import { SessionsPage } from "@renderer/pages/SessionsPage";
import { GithubPage } from "@renderer/pages/GithubPage";
import { SettingsSheet } from "@renderer/components/settings/SettingsSheet";
import { dateTime, localDayKey } from "@renderer/format";


function AppInner() {
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState<PageId>("overview");
  const [range, setRange] = useState<RangeKey>("30d");
  const [connectingClaude, setConnectingClaude] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => new URLSearchParams(window.location.search).get("settings") === "open");
  const { theme, setTheme, accent, setAccent, customAccent, setCustomAccent } = useThemePreference();
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebar();
  // Hoisted for the same reason as githubMonth: page-local state would re-read
  // from disk and flash the default on every visit to Contributions.
  const { order: dayOrder, toggle: toggleDayOrder } = useDayOrder();
  const { snapshot, status, error, refreshing, reload, applySubscriptions, setError } =
    useSnapshot(range);

  // Hoisted above AnimatePresence, which unmounts the page on every navigation.
  // Left inside GithubPage this state would be destroyed on each visit, undoing
  // the retained-month behaviour it exists to provide.
  const githubMonth = useGithubMonth();

  // Shared with Contributions so both read the same full-history index rather
  // than the range-limited snapshot.daily.
  const dailyCost = useDailyCostIndex(snapshot?.generatedAt ?? null);
  const spendToday = dailyCost.get(localDayKey()) ?? null;

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  useHotkey(",", openSettings);
  useHotkey("b", toggleSidebar);

  useEffect(() => window.azulCode?.onOpenSettings(openSettings), [openSettings]);
  useDefaultRefresh(reload, refreshing);
  // Allowance is the one figure that goes stale while you sit on the page, and
  // the home screen now projects a runway from it. Refreshing on its own also
  // re-renders the countdown, so the hero cannot silently freeze.
  useSubscriptionPoll(applySubscriptions);

  const connectClaude = useCallback(async () => {
    if (!window.azulCode) return;
    setConnectingClaude(true);
    setError(null);
    try {
      const claude = await window.azulCode.setupClaudeStatusLine();
      applySubscriptions(
        (snapshot?.subscriptions ?? []).map((usage) => (usage.provider === "claude" ? claude : usage)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Claude Code could not be connected.");
    } finally {
      setConnectingClaude(false);
    }
  }, [applySubscriptions, setError, snapshot]);

  return (
    <div className={`app-shell${sidebarCollapsed ? " app-shell--collapsed" : ""}`}>
      <Sidebar
        page={page}
        onNavigate={setPage}
        snapshot={snapshot}
        onOpenSettings={openSettings}
        collapsed={sidebarCollapsed}
      />

      <main>
        <TopBar
          page={page}
          range={range}
          onRangeChange={setRange}
          theme={theme}
          onThemeChange={setTheme}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />

        <div className="content-scroll">
          <div className="content-container">
            <div className="page-heading">
              <div><h1>{PAGES[page].label}</h1></div>
              {snapshot ? (
                <div className="last-scanned">
                  <span className="status-dot status-dot--connected" />
                  <div><strong>Live local data</strong><span>Updated {dateTime(snapshot.generatedAt)}</span></div>
                </div>
              ) : null}
            </div>

            {error && snapshot ? (
              <div className="warning-banner" role="alert">
                <Info size={15} /><span>{error}</span>
                <button onClick={reload}>Try again</button>
              </div>
            ) : null}
            {snapshot?.warnings.map((warning) => (
              <div className="warning-banner warning-banner--soft" key={warning} role="status">
                <Info size={15} /><span>{warning}</span>
              </div>
            ))}

            {/* An explicit status, so a failed first scan shows a retry instead
                of an error banner above a spinner that never stops. */}
            {status === "loading" ? <LoadingScreen /> : null}
            {status === "error" ? (
              <ErrorState message={error ?? "The local scan could not finish."} onRetry={reload} />
            ) : null}

            {status === "ready" && snapshot ? (
              <AnimatePresence mode="wait">
                <motion.div className="page-content" key={page} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -3 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>
                  {page === "overview" ? <OverviewPage
                      snapshot={snapshot}
                      navigate={setPage}
                      github={githubMonth.data}
                      spendToday={spendToday}
                      connectingClaude={connectingClaude}
                      onConnectClaude={() => void connectClaude()}
                    /> : null}
                  {page === "plans" ? <PlansPage snapshot={snapshot} connectingClaude={connectingClaude} onConnectClaude={() => void connectClaude()} /> : null}
                  {page === "models" ? <ModelsPage snapshot={snapshot} /> : null}
                  {page === "projects" ? <ProjectsPage snapshot={snapshot} /> : null}
                  {page === "sessions" ? <SessionsPage snapshot={snapshot} /> : null}
                  {page === "github" ? <GithubPage snapshot={snapshot} month={githubMonth} order={dayOrder} onToggleOrder={toggleDayOrder} /> : null}
                </motion.div>
              </AnimatePresence>
            ) : null}

            <footer>
              <span>azul-code {__APP_VERSION__}</span>
              <span>API-equivalent estimates · no prompts are read</span>
            </footer>
          </div>
        </div>
      </main>

      {settingsOpen && snapshot ? (
        <SettingsSheet
          snapshot={snapshot}
          theme={theme}
          setTheme={setTheme}
          accent={accent}
          setAccent={setAccent}
          customAccent={customAccent}
          setCustomAccent={setCustomAccent}
          onClose={closeSettings}
        />
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <RefreshProvider>
      <AppInner />
    </RefreshProvider>
  );
}
