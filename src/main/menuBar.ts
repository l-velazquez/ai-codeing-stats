import { join } from "node:path";
import { BrowserWindow, Menu, nativeImage, nativeTheme, screen, Tray } from "electron";
import trayIcon from "../../resources/trayTemplate.png?asset";
import trayIcon2x from "../../resources/trayTemplate@2x.png?asset";
import { menuBarTitle } from "../shared/menuBar";
import { PANEL_MIN_HEIGHT, PANEL_WIDTH, panelBounds, panelHeight } from "../shared/panelBounds";
import { resolveTheme, themeBackground, type Settings } from "../shared/settings";
import type { StatsService } from "./statsService";

export class MenuBar {
  private tray: Tray | null = null;
  private panel: BrowserWindow | null = null;
  private ready = false;
  private wantsOpen = false;
  private contentHeight: number | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private title: string | null = null;
  private tooltip: string | null = null;
  private readonly onDisplayChange = () => { if (this.panel?.isVisible()) this.applyBounds(); };
  private unsubscribe: () => void;

  constructor(private readonly stats: StatsService, private settings: Settings,
    private readonly openDashboard: (settings?: boolean) => void) {
    this.unsubscribe = stats.subscribe(() => this.updateTitle());
    // The dock hiding or a display being plugged in changes the room beneath the tray.
    screen.on("display-metrics-changed", this.onDisplayChange);
    this.configure(settings);
  }

  configure(settings: Settings): void {
    this.settings = settings;
    if (process.platform !== "darwin") return;
    if (!settings.menuBarEnabled) {
      this.destroyWindows();
      return;
    }
    if (!this.tray) {
      const image = nativeImage.createFromPath(trayIcon);
      image.addRepresentation({ scaleFactor: 2, buffer: nativeImage.createFromPath(trayIcon2x).toPNG() });
      image.setTemplateImage(true);
      this.tray = new Tray(image, "b1e1b598-5567-4ca6-996c-bfa98f69fdce");
      this.title = null;
      this.tooltip = null;
      this.tray.setIgnoreDoubleClickEvents(true);
      this.tray.on("click", () => this.toggle());
      this.tray.on("right-click", () => {
        this.hide();
        this.tray?.popUpContextMenu(Menu.buildFromTemplate([
          { label: "Open azul-code", click: () => this.openDashboard() },
          { label: "Settings…", click: () => this.openDashboard(true) },
          { label: "Refresh", click: () => { void this.stats.refresh(); } },
          { type: "separator" },
          { label: "Quit azul-code", role: "quit" },
        ]));
      });
    }
    this.updateTheme();
    this.updateTitle();
  }

  updateTheme(): void {
    const resolved = resolveTheme(this.settings.theme, nativeTheme.shouldUseDarkColors);
    this.panel?.setBackgroundColor(themeBackground(resolved, this.settings.accent, this.settings.customAccent));
  }

  private updateTitle(): void {
    const state = this.stats.getState();
    const title = menuBarTitle(state, this.settings);
    const tooltip = `azul-code · Today's API equivalent (USD) · Allowance remaining\n${state.error
      ? `Update failed: ${state.error}` : state.summary ? `Last scan: ${new Date(state.summary.updatedAt).toLocaleTimeString()}` : "Reading local usage…"}\n* Partial pricing, source error, or stale estimate`;
    // The background loop publishes a state every few seconds; most of them read
    // identically, and repainting the tray for those is work the menu bar can skip.
    if (title === this.title && tooltip === this.tooltip) return;
    this.title = title;
    this.tooltip = tooltip;
    this.tray?.setTitle(title, { fontType: "monospacedDigit" });
    this.tray?.setToolTip(tooltip);
  }

  private createPanel(): BrowserWindow {
    const resolved = resolveTheme(this.settings.theme, nativeTheme.shouldUseDarkColors);
    const panel = new BrowserWindow({
      width: PANEL_WIDTH, height: PANEL_MIN_HEIGHT, show: false, frame: false, resizable: false,
      maximizable: false, minimizable: false, fullscreenable: false,
      skipTaskbar: true, alwaysOnTop: true, roundedCorners: true,
      title: "azul-code menu bar", backgroundColor: themeBackground(resolved, this.settings.accent, this.settings.customAccent),
      webPreferences: {
        preload: join(__dirname, "../preload/index.cjs"), sandbox: true,
        contextIsolation: true, nodeIntegration: false,
        additionalArguments: [`--azul-code-accent=${this.settings.accent}`, `--azul-code-custom=${this.settings.customAccent}`, `--azul-code-theme=${this.settings.theme}`, `--azul-code-resolved=${resolved}`],
      },
    });
    this.panel = panel;
    panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    panel.on("blur", () => {
      // Clicking the tray blurs first; let its click handler perform the toggle.
      const anchor = this.tray?.getBounds();
      const cursor = screen.getCursorScreenPoint();
      if (anchor && cursor.x >= anchor.x && cursor.x <= anchor.x + anchor.width &&
        cursor.y >= anchor.y && cursor.y <= anchor.y + anchor.height) return;
      this.hide();
    });
    // The measured height deliberately survives: a recreated panel renders the same
    // content, so the cached value makes its first frame the right size.
    panel.on("closed", () => { this.clearShowTimer(); this.panel = null; this.ready = false; this.wantsOpen = false; });
    panel.webContents.on("before-input-event", (event, input) => {
      if (input.key === "Escape") { event.preventDefault(); this.hide(); }
    });
    panel.once("ready-to-show", () => {
      this.ready = true;
      if (!this.wantsOpen) return;
      if (this.contentHeight !== null) { this.show(); return; }
      // The measurement normally lands first; never hold the popover hostage if it does not.
      this.showTimer = setTimeout(() => {
        this.showTimer = null;
        if (this.wantsOpen) this.show();
      }, 150);
    });
    if (process.env.ELECTRON_RENDERER_URL) {
      const url = new URL(process.env.ELECTRON_RENDERER_URL);
      url.searchParams.set("view", "menubar");
      void panel.loadURL(url.toString());
    } else {
      void panel.loadFile(join(__dirname, "../renderer/index.html"), { query: { view: "menubar" } });
    }
    return panel;
  }

  /** Renderer-measured natural height; main owns the clamping. */
  setContentHeight(height: number): void {
    const next = Math.ceil(height);
    // Sub-pixel noise and the relative-time ticker must not nudge the window.
    if (this.contentHeight !== null && Math.abs(next - this.contentHeight) < 2) return;
    this.contentHeight = next;
    if (this.panel?.isVisible()) this.applyBounds();
    else if (this.ready && this.wantsOpen) { this.clearShowTimer(); this.show(); }
  }

  private applyBounds(): void {
    const panel = this.panel;
    if (!panel || panel.isDestroyed() || !this.tray) return;
    const anchor = this.tray.getBounds();
    const area = screen.getDisplayMatching(anchor).workArea;
    const height = panelHeight(this.contentHeight ?? 0, anchor, area);
    // macOS pins the min/max size of a non-resizable window and silently drops height
    // changes. The flag is restored synchronously, and the window is frameless, so no
    // drag edge is ever exposed.
    const resizable = panel.isResizable();
    if (!resizable) panel.setResizable(true);
    panel.setBounds(panelBounds(anchor, area, PANEL_WIDTH, height), false);
    if (!resizable) panel.setResizable(false);
  }

  private clearShowTimer(): void {
    if (this.showTimer === null) return;
    clearTimeout(this.showTimer);
    this.showTimer = null;
  }

  private show(): void {
    if (!this.panel || !this.tray) return;
    this.applyBounds();
    this.panel.show();
    this.panel.focus();
  }
  private toggle(): void {
    if (this.wantsOpen) { this.hide(); return; }
    this.wantsOpen = true;
    if (!this.panel) this.createPanel();
    if (this.ready) this.show();
    void this.stats.refresh();
  }
  hide(): void { this.clearShowTimer(); this.wantsOpen = false; this.panel?.hide(); }
  private destroyWindows(): void {
    this.clearShowTimer();
    this.panel?.destroy();
    this.tray?.destroy();
    this.tray = null;
  }
  destroy(): void {
    this.unsubscribe();
    screen.removeListener("display-metrics-changed", this.onDisplayChange);
    this.destroyWindows();
  }
}
