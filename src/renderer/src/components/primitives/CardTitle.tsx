import type { ReactNode } from "react";

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card-title-row">
      <h2>{children}</h2>
      {action}
    </div>
  );
}
