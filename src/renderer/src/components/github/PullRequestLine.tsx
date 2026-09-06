import { openUrl } from "@renderer/lib/bridge";
import type { GitHubPullRequestEntry } from "@shared/types";

export function PullRequestLine({ pullRequest }: { pullRequest: GitHubPullRequestEntry }) {
  return (
    <button className="gh-commit gh-commit--pr" onClick={() => void window.tally?.openUrl(pullRequest.url)} title="Open pull request on GitHub">
      <span className="gh-commit-time">#{pullRequest.number}</span>
      <strong>{pullRequest.title}</strong>
      <span className={`gh-pr-badge${pullRequest.merged ? " gh-pr-badge--merged" : ""}`}>{pullRequest.merged ? "merged" : "open"}</span>
    </button>
  );
}
