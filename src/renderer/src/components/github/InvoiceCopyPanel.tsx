import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ClipboardCopy } from "lucide-react";
import { buildInvoiceSummary, buildProjectInvoice, filterSnapshotRepos } from "@shared/invoice";
import type { GitHubMonthSnapshot } from "@shared/types";
import type { CopyState } from "@renderer/hooks/useCopyToClipboard";

type InvoiceFormat = "project" | "day";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Copy the month for a chosen set of projects. Unticked projects are stored as
 * exclusions, so personal repos stay out of every later invoice too.
 */
export function InvoiceCopyPanel({
  data,
  excluded,
  onExcludedChange,
  copyState,
  onCopy,
}: {
  data: GitHubMonthSnapshot;
  excluded: ReadonlySet<string>;
  onExcludedChange: (repos: Iterable<string>) => void;
  copyState: CopyState;
  onCopy: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<InvoiceFormat>("project");
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => filterSnapshotRepos(data, (repo) => !excluded.has(repo)), [data, excluded]);
  const included = data.repos.filter((repo) => !excluded.has(repo.repo));
  const hasActivity = filtered.totals.commits > 0 || filtered.totals.pullRequests > 0;

  const toggle = (repo: string) => {
    const next = new Set(excluded);
    if (next.has(repo)) next.delete(repo);
    else next.add(repo);
    onExcludedChange(next);
  };
  const setAll = (on: boolean) => {
    const next = new Set(excluded);
    for (const repo of data.repos) {
      if (on) next.delete(repo.repo);
      else next.add(repo.repo);
    }
    onExcludedChange(next);
  };
  const copy = () => onCopy(format === "project" ? buildProjectInvoice(filtered) : buildInvoiceSummary(filtered));

  const label = copyState === "copied" ? "Copied — paste it into your invoice"
    : copyState === "failed" ? "Copy failed — try again"
    : "Copy invoice summary";

  return (
    <div className="invoice-copy" ref={root}>
      <button
        className="copy-summary"
        onClick={() => setOpen((value) => !value)}
        disabled={data.repos.length === 0}
        data-state={copyState}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <ClipboardCopy size={13} />{label}<ChevronDown size={13} />
      </button>
      {open ? (
        <div className="invoice-panel panel" role="dialog" aria-label="Copy invoice summary">
          <div className="invoice-panel-head">
            <strong>Projects to include</strong>
            <span>
              <button className="text-action" onClick={() => setAll(true)}>All</button>
              <button className="text-action" onClick={() => setAll(false)}>None</button>
            </span>
          </div>
          <div className="invoice-repo-list">
            {data.repos.map((repo) => {
              const on = !excluded.has(repo.repo);
              return (
                <label key={repo.repo} className={on ? "invoice-repo is-on" : "invoice-repo"}>
                  <input type="checkbox" checked={on} onChange={() => toggle(repo.repo)} />
                  <i aria-hidden="true">{on ? <Check size={11} /> : null}</i>
                  <span>{repo.repo}</span>
                  <small>{repo.commits > 0 ? plural(repo.commits, "commit") : "pull requests"}</small>
                </label>
              );
            })}
          </div>
          <div className="invoice-format" role="radiogroup" aria-label="Group the summary">
            {(["project", "day"] as const).map((value) => (
              <button key={value} role="radio" aria-checked={format === value} className={format === value ? "is-active" : undefined} onClick={() => setFormat(value)}>
                {value === "project" ? "By project" : "By day"}
              </button>
            ))}
          </div>
          <p className="invoice-panel-note">
            {included.length === data.repos.length
              ? "Every project this month is included."
              : `${plural(data.repos.length - included.length, "project")} left out. Your choice is remembered next month.`}
          </p>
          <button className="copy-summary invoice-panel-copy" onClick={copy} disabled={!hasActivity}>
            <ClipboardCopy size={13} />
            {hasActivity ? `Copy ${plural(filtered.totals.commits, "commit")} from ${plural(filtered.totals.repos, "project")}` : "Nothing selected"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
