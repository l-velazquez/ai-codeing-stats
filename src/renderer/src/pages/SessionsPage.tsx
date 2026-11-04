import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { SessionRow } from "@renderer/components/data/SessionRow";
import { EmptyState } from "@renderer/components/primitives/EmptyState";
import type { StatsSnapshot } from "@shared/types";

const PAGE_SIZE = 50;

export function SessionsPage({ snapshot }: { snapshot: StatsSnapshot }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const ledger = useRef<HTMLElement>(null);
  const sessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return snapshot.sessions;
    return snapshot.sessions.filter((session) =>
      `${session.project} ${session.model} ${session.models.join(" ")} ${session.provider}`.toLowerCase().includes(normalized),
    );
  }, [query, snapshot.sessions]);
  const pageCount = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const visible = sessions.slice(start, start + PAGE_SIZE);

  useEffect(() => { setPage(0); }, [query, snapshot.range]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount - 1)); }, [pageCount]);
  const changePage = (next: number) => {
    setPage(next);
    ledger.current?.scrollIntoView?.({ block: "start" });
  };
  return (
    <div className="page-stack">
      <section className="session-toolbar panel">
        <div className="search-field"><Search size={15} /><input aria-label="Search sessions by project, model, or provider" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project or model…" /></div>
        <span>{sessions.length} of {snapshot.sessions.length} sessions</span>
      </section>
      <section className="panel sessions-panel" ref={ledger}>
        <div className="session-header"><span>Session</span><span>When</span><span>Usage</span><span>Equivalent</span></div>
        {visible.map((session) => <SessionRow key={session.id} session={session} />)}
        {sessions.length === 0 ? <EmptyState label="No matching sessions" /> : null}
        {sessions.length > PAGE_SIZE ? (
          <nav className="session-pagination" aria-label="Session pages">
            <span aria-live="polite">{start + 1}–{start + visible.length} of {sessions.length} sessions</span>
            <div>
              <button onClick={() => changePage(currentPage - 1)} disabled={currentPage === 0}>Previous</button>
              <span>Page {currentPage + 1} of {pageCount}</span>
              <button onClick={() => changePage(currentPage + 1)} disabled={currentPage === pageCount - 1}>Next</button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
