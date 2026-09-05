import { ChevronRight, CircleDollarSign, Clock3, Database, Layers3, WalletCards } from "lucide-react";
import type { PageId } from "@renderer/app/routes";
import { UsageChart } from "@renderer/components/UsageChart";
import { ActivityCalendar } from "@renderer/components/data/ActivityCalendar";
import { ModelRow } from "@renderer/components/data/ModelRow";
import { ProjectRow } from "@renderer/components/data/ProjectRow";
import { ProviderBreakdown } from "@renderer/components/data/ProviderBreakdown";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { EmptyState } from "@renderer/components/primitives/EmptyState";
import { Kpi } from "@renderer/components/primitives/Kpi";
import { RANGE_LABELS } from "@renderer/components/shell/RangeControl";
import { AllowanceHeadline } from "@renderer/components/allowance/AllowanceHeadline";
import { TodaysWork } from "@renderer/components/data/TodaysWork";
import type { DayCost } from "@renderer/hooks/useDailyCostIndex";
import { compact, money, percent } from "@renderer/format";
import type { GitHubMonthSnapshot, StatsSnapshot } from "@shared/types";

export function OverviewPage({
  snapshot,
  navigate,
  github,
  spendToday,
  connectingClaude,
  onConnectClaude,
}: {
  snapshot: StatsSnapshot;
  navigate: (page: PageId) => void;
  github: GitHubMonthSnapshot | null;
  spendToday: DayCost | null;
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
              <span className="eyebrow"><CircleDollarSign size={13} /> API-equivalent spend</span>
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

      <section className="kpi-grid">
        <Kpi icon={Layers3} label="Processed tokens" value={compact(snapshot.summary.totalTokens)} detail={`${compact(inputTokens)} input · ${compact(snapshot.summary.tokens.output)} output`} />
        <Kpi icon={Database} label="Cache hit rate" value={percent(snapshot.summary.cacheHitRate)} detail={`${compact(snapshot.summary.tokens.cachedInput)} tokens reused`} accent />
        <Kpi icon={WalletCards} label="Cache savings" value={money(snapshot.summary.savings)} detail="Compared with uncached input" />
        <Kpi icon={Clock3} label="Average session" value={money(snapshot.summary.cost / Math.max(1, snapshot.summary.sessions))} detail={`${compact(snapshot.summary.totalTokens / Math.max(1, snapshot.summary.sessions))} tokens each`} />
      </section>

      <TodaysWork
        github={github}
        spendToday={spendToday}
        onOpenContributions={() => navigate("github")}
      />

      <section className="split-panels">
        <div className="panel list-panel">
          <CardTitle action={<button className="text-action" onClick={() => navigate("models")}>View all <ChevronRight size={13} /></button>}>Models</CardTitle>
          <div className="table-header model-row"><span>Model</span><span>Cache efficiency</span><span>Spend</span><span>Tokens</span><span>Runs</span></div>
          {snapshot.models.slice(0, 5).map((model) => <ModelRow key={`${model.provider}:${model.model}`} model={model} maxCost={maxModel} />)}
          {snapshot.models.length === 0 ? <EmptyState compactMode label="No model usage in this range" /> : null}
        </div>
        <ActivityCalendar snapshot={snapshot} />
      </section>

      <section className="panel list-panel project-panel">
        <CardTitle action={<button className="text-action" onClick={() => navigate("projects")}>View all <ChevronRight size={13} /></button>}>Most active projects</CardTitle>
        {snapshot.projects.slice(0, 5).map((project) => <ProjectRow key={project.path || project.name} project={project} maxCost={maxProject} />)}
        {snapshot.projects.length === 0 ? <EmptyState compactMode label="No workspace activity in this range" /> : null}
      </section>
    </>
  );
}
