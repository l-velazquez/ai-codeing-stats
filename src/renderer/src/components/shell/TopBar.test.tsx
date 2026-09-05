import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RefreshProvider } from "@renderer/providers/RefreshProvider";
import { TopBar } from "./TopBar";

function renderTopBar(page: Parameters<typeof TopBar>[0]["page"], onTheme = vi.fn()) {
  render(
    <RefreshProvider>
      <TopBar
        page={page}
        range="30d"
        onRangeChange={vi.fn()}
        theme="dark"
        onThemeChange={onTheme}
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

  it("hides refresh until a page claims it", () => {
    renderTopBar("overview");
    expect(screen.queryByRole("button", { name: /^Refresh/ })).not.toBeInTheDocument();
  });
});
