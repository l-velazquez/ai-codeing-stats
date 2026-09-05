import { Boxes, CreditCard, FolderCode, Gauge, GitBranch, Settings, TerminalSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type PageId =
  | "overview"
  | "plans"
  | "models"
  | "projects"
  | "sessions"
  | "github"
  | "sources";

export interface PageDefinition {
  readonly id: PageId;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Whether the shared range control does anything on this page. */
  readonly supportsRange: boolean;
  /** Whether this page is listed in the sidebar's main navigation. */
  readonly inNavigation: boolean;
}

export const PAGES: Record<PageId, PageDefinition> = {
  overview: { id: "overview", label: "Overview", icon: Gauge, supportsRange: true, inNavigation: true },
  plans: { id: "plans", label: "Plans", icon: CreditCard, supportsRange: true, inNavigation: true },
  models: { id: "models", label: "Models", icon: Boxes, supportsRange: true, inNavigation: true },
  projects: { id: "projects", label: "Projects", icon: FolderCode, supportsRange: true, inNavigation: true },
  sessions: { id: "sessions", label: "Sessions", icon: TerminalSquare, supportsRange: true, inNavigation: true },
  // Contributions is driven by its own month cursor, not the global range.
  github: { id: "github", label: "Contributions", icon: GitBranch, supportsRange: false, inNavigation: true },
  // Reached from the sidebar's System group rather than the main list.
  sources: { id: "sources", label: "Data & settings", icon: Settings, supportsRange: false, inNavigation: false },
};

export const NAVIGATION: readonly PageDefinition[] = Object.values(PAGES).filter(
  (page) => page.inNavigation,
);

export function pageTitle(page: PageId): string {
  return PAGES[page].label;
}
