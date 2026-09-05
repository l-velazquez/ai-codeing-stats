import { BarChart3 } from "lucide-react";

export function EmptyState({ label, compactMode = false }: { label: string; compactMode?: boolean }) {
  return <div className={`empty-state${compactMode ? " empty-state--compact" : ""}`}><BarChart3 size={20} /><span>{label}</span></div>;
}
