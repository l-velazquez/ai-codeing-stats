import { ChevronRight } from "lucide-react";
import type { PageId } from "@renderer/app/routes";
import { UsageChart } from "@renderer/components/UsageChart";
import { ActivityCalendar } from "@renderer/components/data/ActivityCalendar";
import { ModelRow } from "@renderer/components/data/ModelRow";
import { ProjectRow } from "@renderer/components/data/ProjectRow";
import { ProviderBreakdown } from "@renderer/components/data/ProviderBreakdown";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { EmptyState } from "@renderer/components/primitives/EmptyState";
import { StatRail } from "@renderer/components/primitives/StatRail";
import { RANGE_LABELS } from "@renderer/components/shell/RangeControl";
import { AllowanceHeadline } from "@renderer/components/allowance/AllowanceHeadline";
import { RecentWork } from "@renderer/components/data/RecentWork";
import type { RecentGithubDays } from "@renderer/hooks/useRecentGithubDays";
import type { DayCost } from "@renderer/hooks/useDailyCostIndex";
import { compact, money, percent } from "@renderer/format";
import type { StatsSnapshot } from "@shared/types";

export function OverviewPage({
  snapshot,
  navigate,
  github,
  dailyCost,
  connectingClaude,
  onConnectClaude,
}: {
  snapshot: StatsSnapshot;
  navigate: (page: PageId) => void;
  github: RecentGithubDays;
  dailyCost: ReadonlyMap<string, DayCost>;
  connectingClaude: boolean;
  onConnectClaude: () => void;
}) {
  const maxModel = snapshot.models[0]?.cost ?? 1;
  const maxProject = snapshot.projects[0]?.cost ?? 1;
  const inputTokens =
    snapshot.summary.tokens.uncachedInput +
    snapshot.summary.tokens.cachedInput +
    snapshot.summary.tokens.cacheWrite5m +
    snapshot.summary.tokens.cacheWrite1h;
  const sessions = Math.max(1, snapshot.summary.sessions);
  return (
    <>
      <AllowanceHeadline
        snapshot={snapshot}
        connecting={connectingClaude}
        onConnectClaude={onConnectClaude}
        onOpenDetail={() => navigate("plans")}
      />

      <section className="overview-hero">
        <div className="hero panel">
          <div className="hero-heading">
            <div>
              <span className="hero-label">API-equivalent spend</span>
              <div className="hero-value">{money(snapshot.summary.cost)}</div>
              <p>{snapshot.summary.sessions} local sessions · {RANGE_LABELS[snapshot.range].toLowerCase()}</p>
            </div>
            <div className="projection-pill">
              <span>30-day pace</span>
              <strong>{money(snapshot.summary.projectedMonthly)}</strong>
            </div>
          </div>
          <UsageChart data={snapshot.daily} />
        </div>
        <ProviderBreakdown snapshot={snapshot} />
      </section>

      <StatRail
        stats={[
          {
            label: "Processed tokens",
            value: compact(snapshot.summary.totalTokens),
            detail: `${compact(inputTokens)} input · ${compact(snapshot.summary.tokens.output)} output`,
          },
          {
            label: "Cache hit rate",
            value: percent(snapshot.summary.cacheHitRate),
            detail: `${compact(snapshot.summary.tokens.cachedInput)} tokens reused`,
          },
          {
            label: "Cache savings",
            value: money(snapshot.summary.savings),
            detail: "Compared with uncached input",
          },
          {
            label: "Average session",
            value: money(snapshot.summary.cost / sessions),
            detail: `${compact(snapshot.summary.totalTokens / sessions)} tokens each`,
          },
        ]}
      />

      <RecentWork
        github={github}
        spend={dailyCost}
        onOpenContributions={() => navigate("github")}
      />

      <section className="split-panels">
        <div className="panel list-panel">
          <CardTitle action={<button className="text-action" onClick={() => navigate("models")}>View all <ChevronRight size={13} /></button>}>Models</CardTitle>
          <div className="table-well well">
            <div className="table-header model-row"><span>Model</span><span>Cache efficiency</span><span>Spend</span><span>Tokens</span><span>Runs</span></div>
            {snapshot.models.slice(0, 5).map((model) => <ModelRow key={`${model.provider}:${model.model}`} model={model} maxCost={maxModel} />)}
            {snapshot.models.length === 0 ? <EmptyState compactMode label="No model usage in this range" /> : null}
          </div>
        </div>
        <ActivityCalendar snapshot={snapshot} />
      </section>

      <section className="panel list-panel project-panel">
        <CardTitle action={<button className="text-action" onClick={() => navigate("projects")}>View all <ChevronRight size={13} /></button>}>Most active projects</CardTitle>
        <div className="table-well well">
          {snapshot.projects.slice(0, 5).map((project) => <ProjectRow key={project.path || project.name} project={project} maxCost={maxProject} />)}
          {snapshot.projects.length === 0 ? <EmptyState compactMode label="No workspace activity in this range" /> : null}
        </div>
      </section>
    </>
  );
}
