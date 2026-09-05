import { Activity } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-mark"><Activity size={23} /></div>
      <strong>Reading local usage</strong>
      <span>Scanning Codex, Claude Code, and OpenCode metadata…</span>
      <div className="loading-bar"><i /></div>
    </div>
  );
}
