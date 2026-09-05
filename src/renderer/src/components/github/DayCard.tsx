import { ClipboardCopy, Copy, GitBranch, GitPullRequest, Sparkles } from "lucide-react";
import { CommitLine } from "@renderer/components/github/CommitLine";
import { PullRequestLine } from "@renderer/components/github/PullRequestLine";
import { money } from "@renderer/format";
import { dayLabel } from "@shared/invoice";
import type { GitHubDay } from "@shared/types";
import type { CopyState } from "@renderer/hooks/useCopyToClipboard";

export function DayCard({ day, ai, copyState, onCopy }: {
  day: GitHubDay;
  ai: Map<string, { sessions: number; cost: number }>;
  copyState: CopyState;
  onCopy: (day: GitHubDay) => void;
}) {
  const aiPoint = ai.get(day.date);
  return (
    <div className="panel gh-day" id={`gh-day-${day.date}`}>
      <div className="gh-day-head">
        <div className="gh-day-title"><strong>{dayLabel(day.date)}</strong><span>{day.commits} commits · {day.repos.length} {day.repos.length === 1 ? "project" : "projects"}</span></div>
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
        {day.repos.map((group) => (
          <div className="gh-repo-group" key={group.repo}>
            <div className="gh-repo-name"><GitBranch size={12} /><span>{group.repo}</span><small>{group.commits.length}</small></div>
            {group.commits.map((commit) => <CommitLine key={commit.sha} commit={commit} />)}
          </div>
        ))}
        {day.pullRequests.length > 0 ? (
          <div className="gh-repo-group">
            <div className="gh-repo-name"><GitPullRequest size={12} /><span>Pull requests</span><small>{day.pullRequests.length}</small></div>
            {day.pullRequests.map((pullRequest) => <PullRequestLine key={pullRequest.number} pullRequest={pullRequest} />)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
