import { ChevronRight, GitBranch } from "lucide-react";
import type { GitHubMonthSnapshot } from "@shared/types";
import type { DayCost } from "@renderer/hooks/useDailyCostIndex";
import { CardTitle } from "@renderer/components/primitives/CardTitle";
import { localDayKey, money } from "@renderer/format";

/**
 * Spend and output for the same day, side by side.
 *
 * This pairing already existed as a small chip buried on the Contributions
 * page, and it is the one thing in the app that connects what the money bought
 * to what shipped. It is not a claim of causation -- just the two figures on
 * the same axis.
 */
export function TodaysWork({
  github,
  spendToday,
  onOpenContributions,
}: {
  github: GitHubMonthSnapshot | null;
  spendToday: DayCost | null;
  onOpenContributions: () => void;
}) {
  const key = localDayKey();
  const day = github?.days.find((entry) => entry.date === key) ?? null;
  const commits = day?.commits ?? 0;
  const pullRequests = day?.pullRequests.length ?? 0;
  const nothingYet = commits === 0 && pullRequests === 0 && (spendToday?.sessions ?? 0) === 0;

  return (
    <section className="panel list-panel todays-work">
      <CardTitle
        action={
          <button className="text-action" onClick={onOpenContributions}>
            Full month <ChevronRight size={13} />
          </button>
        }
      >
        Today
      </CardTitle>

      {nothingYet ? (
        <p className="todays-work-empty">Nothing recorded yet today. Start a coding session and it will show up here.</p>
      ) : (
        <>
          <div className="todays-work-figures">
            <div>
              <span>Spent</span>
              <strong>{money(spendToday?.cost ?? 0)}</strong>
              <small>{spendToday?.sessions ?? 0} sessions</small>
            </div>
            <div>
              <span>Committed</span>
              <strong>{commits}</strong>
              <small>{commits === 1 ? "commit" : "commits"}</small>
            </div>
            <div>
              <span>Pull requests</span>
              <strong>{pullRequests}</strong>
              <small>opened today</small>
            </div>
          </div>

          {day && day.repos.length > 0 ? (
            <div className="todays-work-repos">
              {day.repos.map((group) => (
                <div key={group.repo}>
                  <GitBranch size={12} />
                  <span>{group.repo.split("/")[1] ?? group.repo}</span>
                  <small>{group.commits.length}</small>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
