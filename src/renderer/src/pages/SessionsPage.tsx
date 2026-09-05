import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SessionRow } from "@renderer/components/data/SessionRow";
import { EmptyState } from "@renderer/components/primitives/EmptyState";
import type { StatsSnapshot } from "@shared/types";

export function SessionsPage({ snapshot }: { snapshot: StatsSnapshot }) {
  const [query, setQuery] = useState("");
  const sessions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return snapshot.sessions;
    return snapshot.sessions.filter((session) =>
      `${session.project} ${session.model} ${session.provider}`.toLowerCase().includes(normalized),
    );
  }, [query, snapshot.sessions]);
  return (
    <div className="page-stack">
      <section className="session-toolbar panel">
        <div className="search-field"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search project or model…" /></div>
        <span>{sessions.length} of {snapshot.sessions.length} sessions</span>
      </section>
      <section className="panel sessions-panel">
        <div className="session-header"><span>Session</span><span>When</span><span>Usage</span><span>Equivalent</span></div>
        {sessions.map((session) => <SessionRow key={session.id} session={session} />)}
        {sessions.length === 0 ? <EmptyState label="No matching sessions" /> : null}
      </section>
    </div>
  );
}
