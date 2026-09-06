import { BrandMark } from "../BrandMark";

export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-mark"><BrandMark size={28} /></div>
      <strong>Reading local usage</strong>
      <span>Scanning Codex, Claude Code, and OpenCode metadata…</span>
      <div className="loading-bar"><i /></div>
    </div>
  );
}
