import { ClipboardCopy, Copy, GitBranch, GitPullRequest, Sparkles } from "lucide-react";
import { CommitLine } from "@renderer/components/github/CommitLine";
import { PullRequestLine } from "@renderer/components/github/PullRequestLine";
import { money } from "@renderer/format";
import { dayLabel } from "@shared/invoice";
import type { GitHubCommitEntry, GitHubDay, GitHubPullRequestEntry } from "@shared/types";
import type { CopyState } from "@renderer/hooks/useCopyToClipboard";

interface DayProjectGroup {
  repo: string;
  commits: GitHubCommitEntry[];
  pullRequests: GitHubPullRequestEntry[];
}

// Pull requests carry their own repo, so they belong with that project's commits
// instead of an unlabelled bucket at the bottom of the day.
function groupByProject(day: GitHubDay): DayProjectGroup[] {
  const groups = new Map<string, DayProjectGroup>();
  const groupFor = (repo: string) => {
    let group = groups.get(repo);
    if (!group) {
      group = { repo, commits: [], pullRequests: [] };
      groups.set(repo, group);
    }
    return group;
  };
  for (const group of day.repos) groupFor(group.repo).commits.push(...group.commits);
  for (const pullRequest of day.pullRequests) groupFor(pullRequest.repo).pullRequests.push(pullRequest);
  return [...groups.values()];
}

function groupSummary(group: DayProjectGroup): string {
  const parts: string[] = [];
  if (group.commits.length > 0) parts.push(`${group.commits.length} ${group.commits.length === 1 ? "commit" : "commits"}`);
  if (group.pullRequests.length > 0) parts.push(`${group.pullRequests.length} ${group.pullRequests.length === 1 ? "pull request" : "pull requests"}`);
  return parts.join(" · ");
}

export function DayCard({ day, ai, copyState, onCopy }: {
  day: GitHubDay;
  ai: Map<string, { sessions: number; cost: number }>;
  copyState: CopyState;
  onCopy: (day: GitHubDay) => void;
}) {
  const aiPoint = ai.get(day.date);
  const groups = groupByProject(day);
  return (
    <div className="panel gh-day" id={`gh-day-${day.date}`}>
      <div className="gh-day-head">
        <div className="gh-day-title"><strong>{dayLabel(day.date)}</strong><span>{day.commits} commits · {groups.length} {groups.length === 1 ? "project" : "projects"}</span></div>
        {aiPoint ? (
          <span className="gh-ai-chip" title="Local AI coding activity measured on this Mac">
            <Sparkles size={11} />{aiPoint.sessions} AI sessions · {money(aiPoint.cost)}
          </span>
        ) : null}
        <button className="text-action gh-copy" onClick={() => onCopy(day)} data-state={copyState}>
          {copyState === "copied" ? <><Copy size={12} /> Copied</>
            : copyState === "failed" ? <><ClipboardCopy size={12} /> Copy failed</>
            : <><ClipboardCopy size={12} /> Copy</>}
        </button>
      </div>
      <div className="gh-day-body">
        {groups.map((group) => (
          <div className="gh-repo-group" key={group.repo}>
            <div className="gh-repo-name">
              {group.commits.length > 0 ? <GitBranch size={12} /> : <GitPullRequest size={12} />}
              <span>{group.repo}</span>
              <small>{groupSummary(group)}</small>
            </div>
            {group.commits.map((commit) => <CommitLine key={commit.sha} commit={commit} />)}
            {group.pullRequests.map((pullRequest) => <PullRequestLine key={`${group.repo}#${pullRequest.number}`} pullRequest={pullRequest} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
