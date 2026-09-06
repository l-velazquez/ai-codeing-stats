import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RefreshProvider } from "@renderer/providers/RefreshProvider";
import { TopBar } from "./TopBar";

function renderTopBar(
  page: Parameters<typeof TopBar>[0]["page"],
  onTheme = vi.fn(),
  { collapsed = false, onToggleSidebar = vi.fn() } = {},
) {
  render(
    <RefreshProvider>
      <TopBar
        page={page}
        range="30d"
        onRangeChange={vi.fn()}
        theme="dark"
        onThemeChange={onTheme}
        sidebarCollapsed={collapsed}
        onToggleSidebar={onToggleSidebar}
      />
    </RefreshProvider>,
  );
  return onTheme;
}

describe("TopBar", () => {
  it("offers the range control where it changes something", () => {
    renderTopBar("overview");
    expect(screen.getByRole("group", { name: "Date range" })).toBeInTheDocument();
  });

  it("hides the range control on pages it cannot affect", () => {
    // Contributions is driven by its own month cursor; Data & settings has no
    // time dimension. Rendering a control that silently does nothing there is
    // indistinguishable from a broken one.
    renderTopBar("github");
    expect(screen.queryByRole("group", { name: "Date range" })).not.toBeInTheDocument();
  });

  it("keeps the theme control available on every page", async () => {
    const onTheme = renderTopBar("github");
    const toggle = screen.getByRole("button", { name: /Theme: Dark/ });
    await userEvent.click(toggle);
    expect(onTheme).toHaveBeenCalledWith("light");
  });

  it("toggles the sidebar from the top bar", async () => {
    const onToggleSidebar = vi.fn();
    renderTopBar("overview", vi.fn(), { onToggleSidebar });
    await userEvent.click(screen.getByRole("button", { name: /Hide sidebar/ }));
    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("offers to show the sidebar again once it is hidden", () => {
    // The control has to survive the sidebar it hides, or there is no way back
    // for anyone who does not know the shortcut.
    renderTopBar("overview", vi.fn(), { collapsed: true });
    const toggle = screen.getByRole("button", { name: /Show sidebar/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "app-sidebar");
  });

  it("hides refresh until a page claims it", () => {
    renderTopBar("overview");
    expect(screen.queryByRole("button", { name: /^Refresh/ })).not.toBeInTheDocument();
  });
});
