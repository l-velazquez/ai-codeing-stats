import { Boxes, CreditCard, FolderCode, Gauge, GitBranch, TerminalSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PageId =
  | "overview"
  | "plans"
  | "models"
  | "projects"
  | "sessions"
  | "github";

export interface PageDefinition {
  readonly id: PageId;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Whether the shared range control does anything on this page. */
  readonly supportsRange: boolean;
}

export const PAGES: Record<PageId, PageDefinition> = {
  overview: { id: "overview", label: "Overview", icon: Gauge, supportsRange: true },
  plans: { id: "plans", label: "Plans", icon: CreditCard, supportsRange: true },
  models: { id: "models", label: "Models", icon: Boxes, supportsRange: true },
  projects: { id: "projects", label: "Projects", icon: FolderCode, supportsRange: true },
  sessions: { id: "sessions", label: "Sessions", icon: TerminalSquare, supportsRange: true },
  // Contributions is driven by its own month cursor, not the global range.
  github: { id: "github", label: "Contributions", icon: GitBranch, supportsRange: false },
};

export const NAVIGATION: readonly PageDefinition[] = Object.values(PAGES);

export function pageTitle(page: PageId): string {
  return PAGES[page].label;
}
