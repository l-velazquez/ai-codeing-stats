import { join } from "node:path";
import { BrowserWindow, Menu, nativeImage, nativeTheme, screen, Tray } from "electron";
import trayIcon from "../../resources/trayTemplate.png?asset";
import trayIcon2x from "../../resources/trayTemplate@2x.png?asset";
import { menuBarTitle } from "../shared/menuBar";
import { panelBounds } from "../shared/panelBounds";
import { resolveTheme, themeBackground, type Settings } from "../shared/settings";
import type { StatsService } from "./statsService";

export class MenuBar {
  private tray: Tray | null = null;
  private panel: BrowserWindow | null = null;
  private ready = false;
  private wantsOpen = false;
  private unsubscribe: () => void;

  constructor(private readonly stats: StatsService, private settings: Settings,
    private readonly openDashboard: (settings?: boolean) => void) {
    this.unsubscribe = stats.subscribe(() => this.updateTitle());
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
    this.panel?.setBackgroundColor(themeBackground(resolved, this.settings.accent));
  }

  private updateTitle(): void {
    const state = this.stats.getState();
    this.tray?.setTitle(menuBarTitle(state, this.settings), { fontType: "monospacedDigit" });
    this.tray?.setToolTip(`azul-code · Today's API equivalent (USD) · Allowance remaining\n${state.error
      ? `Update failed: ${state.error}` : state.summary ? `Last scan: ${new Date(state.summary.updatedAt).toLocaleTimeString()}` : "Reading local usage…"}\n* Partial pricing, source error, or stale estimate`);
  }

  private createPanel(): BrowserWindow {
    const resolved = resolveTheme(this.settings.theme, nativeTheme.shouldUseDarkColors);
    const panel = new BrowserWindow({
      width: 360, height: 620, show: false, frame: false, resizable: false,
      maximizable: false, minimizable: false, fullscreenable: false,
      skipTaskbar: true, alwaysOnTop: true, roundedCorners: true,
      title: "azul-code menu bar", backgroundColor: themeBackground(resolved, this.settings.accent),
      webPreferences: {
        preload: join(__dirname, "../preload/index.cjs"), sandbox: true,
        contextIsolation: true, nodeIntegration: false,
        additionalArguments: [`--azul-code-accent=${this.settings.accent}`, `--azul-code-theme=${this.settings.theme}`, `--azul-code-resolved=${resolved}`],
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
    panel.on("closed", () => { this.panel = null; this.ready = false; this.wantsOpen = false; });
    panel.webContents.on("before-input-event", (event, input) => {
      if (input.key === "Escape") { event.preventDefault(); this.hide(); }
    });
    panel.once("ready-to-show", () => {
      this.ready = true;
      if (this.wantsOpen) this.show();
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

  private show(): void {
    if (!this.panel || !this.tray) return;
    const anchor = this.tray.getBounds();
    this.panel.setBounds(panelBounds(anchor, screen.getDisplayMatching(anchor).workArea));
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
  hide(): void { this.wantsOpen = false; this.panel?.hide(); }
  private destroyWindows(): void {
    this.panel?.destroy();
    this.tray?.destroy();
    this.tray = null;
  }
  destroy(): void { this.unsubscribe(); this.destroyWindows(); }
}
