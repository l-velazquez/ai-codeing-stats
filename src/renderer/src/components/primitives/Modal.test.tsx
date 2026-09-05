import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

function Harness({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button>opener</button>
      <Modal title="Settings" onClose={onClose}>
        <button>first</button>
        <button>second</button>
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("is an accessible dialog", () => {
    render(<Harness onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("moves focus inside on open", () => {
    render(<Harness onClose={vi.fn()} />);
    // The close control is the first focusable in the panel, so focus lands
    // inside the dialog rather than staying on the page behind it.
    expect(screen.getByRole("button", { name: "Close settings" })).toHaveFocus();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the scrim is clicked but not the panel", async () => {
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(container.querySelector(".modal-scrim")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the dialog", async () => {
    const { container } = render(<Harness onClose={vi.fn()} />);
    const panel = container.querySelector(".modal-panel")!;
    // Tab past the last focusable; focus must wrap rather than escaping to the
    // opener button rendered behind the sheet.
    for (let i = 0; i < 4; i += 1) await userEvent.tab();
    expect(panel.contains(document.activeElement)).toBe(true);
  });
});
