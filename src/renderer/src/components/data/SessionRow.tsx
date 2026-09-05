import { ProviderMark } from "@renderer/components/ProviderMark";
import { compact, duration, modelName, money, relative } from "@renderer/format";
import type { SessionStat } from "@shared/types";

export function SessionRow({ session }: { session: SessionStat }) {
  return (
    <div className="session-row">
      <ProviderMark provider={session.provider} />
      <div className="session-project">
        <strong>{session.project}</strong>
        <span>{modelName(session.model)}</span>
      </div>
      <div className="session-time"><strong>{relative(session.endedAt)}</strong><span>{duration(session.startedAt, session.endedAt)}</span></div>
      <div className="session-tokens"><strong>{compact(session.totalTokens)}</strong><span>{session.records} turns</span></div>
      <div className="session-cost"><strong>{money(session.cost)}</strong><span>{session.priced ? "API equiv." : "partial"}</span></div>
    </div>
  );
}
