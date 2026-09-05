import { ArrowUpRight } from "lucide-react";
import { openUrl } from "@renderer/lib/bridge";
import type { GitHubCommitEntry } from "@shared/types";

export function CommitLine({ commit }: { commit: GitHubCommitEntry }) {
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(commit.at);
  return (
    <button className="gh-commit" onClick={() => void window.tokenary?.openUrl(commit.url)} title="Open commit on GitHub">
      <span className="gh-commit-time">{time}</span>
      <strong>{commit.message}</strong>
      <ArrowUpRight size={12} />
    </button>
  );
}
