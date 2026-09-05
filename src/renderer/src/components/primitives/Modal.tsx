import { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Focus is trapped while open and restored to whatever opened the sheet, so
 * reaching settings by keyboard does not strand you.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    return () => restoreTo.current?.focus?.();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || panel.current === null) return;
      // No visibility filter: offsetParent and getClientRects both report
      // nothing under jsdom, which would silently disable the trap in tests.
      // Everything inside this panel is visible while it is open.
      const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <div className="modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        onKeyDown={onKeyDown}
      >
        <header className="modal-head">
          <strong>{title}</strong>
          <button className="icon-button" onClick={onClose} aria-label="Close settings"><X size={15} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
