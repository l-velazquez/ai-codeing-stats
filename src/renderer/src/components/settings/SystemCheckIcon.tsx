import { Code2, GitBranch } from "lucide-react";
import { ProviderMark } from "@renderer/components/ProviderMark";
import type { SystemCheck } from "@shared/types";

export function SystemCheckIcon({ check }: { check: SystemCheck }) {
  if (check.id === "codex" || check.id === "claude" || check.id === "opencode") {
    return <ProviderMark provider={check.id} />;
  }
  return <span className="system-check-icon">{check.id === "github" ? <GitBranch size={15} /> : <Code2 size={15} />}</span>;
}
