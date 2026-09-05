import { motion } from "motion/react";
import type { Activity } from "lucide-react";

export function Kpi({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <motion.div className={`kpi panel${accent ? " kpi--accent" : ""}`} layout>
      <div className="kpi-icon"><Icon size={15} /></div>
      <div className="kpi-label">{label}</div>
      <strong>{value}</strong>
      <span>{detail}</span>
    </motion.div>
  );
}
