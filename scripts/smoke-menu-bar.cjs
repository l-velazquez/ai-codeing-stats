const { app, BrowserWindow, Tray, ipcMain, nativeImage, screen } = require('electron');
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { tmpdir } = require('node:os');

// Exercise the compiled app with isolated preferences; local usage is read-only.
const artifacts = mkdtempSync(join(tmpdir(), 'azul-code-menubar-'));
const assert = require('node:assert/strict');
const testData = join(artifacts, 'profile');
mkdirSync(testData);
app.setPath('userData', testData);
const handlers = new Map();
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) => { handlers.set(channel, listener); return handle(channel, listener); };
let tray;
const setTitle = Tray.prototype.setTitle;
Tray.prototype.setTitle = function (...args) { tray = this; return setTitle.apply(this, args); };
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  const start = Date.now();
  while (Date.now() - start < 30000) { if (await check()) return; await pause(100); }
  throw new Error('Timed out: ' + label);
}
const call = (channel, ...args) => handlers.get(channel)({}, ...args);
(async () => {
  await import(pathToFileURL(join(process.cwd(), 'out/main/index.js')).href);
  await app.whenReady();
  await until(() => handlers.has('azul-code:menubar-get') && tray, 'startup');
  await until(() => call('azul-code:menubar-get').summary, 'initial scan');
  const initial = call('azul-code:menubar-get');
  assert.equal(initial.error, null);
  assert.ok(tray.getTitle().length > 0);
  assert.equal(nativeImage.createFromPath(join(process.cwd(), 'resources/trayTemplate.png')).isEmpty(), false);
  let dashboard = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'azul-code');
  assert.ok(dashboard);
  tray.emit('click');
  await until(() => BrowserWindow.getAllWindows().length === 2, 'panel created');
  const panel = BrowserWindow.getAllWindows().find(w => w !== dashboard);
  await until(async () => !panel.webContents.isLoading() && await panel.webContents.executeJavaScript('!!document.querySelector(".menubar-cost")'), 'panel render');
  await until(() => !call('azul-code:menubar-get').refreshing, 'panel refresh completed');
  await pause(200);
  assert.equal(await panel.webContents.executeJavaScript('typeof window.azulCode.menuBar.get'), 'function');
  assert.equal(await panel.webContents.executeJavaScript('document.querySelectorAll(".menubar-provider-row").length'), 3);
  assert.equal(await panel.webContents.executeJavaScript('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await panel.webContents.executeJavaScript('document.querySelector(".menubar-footer").getBoundingClientRect().bottom <= innerHeight'), true);
  // The window is sized to its content: wide enough, no scrollbar, and not the old fixed 620.
  assert.equal(panel.getBounds().width, 400);
  assert.equal(await panel.webContents.executeJavaScript('const e=document.querySelector(".menubar-content");e.scrollHeight <= e.clientHeight + 1'), true);
  const fitted = panel.getBounds().height;
  assert.notEqual(fitted, 300);  // a real measurement arrived, not the unmeasured floor
  const area = screen.getDisplayMatching(tray.getBounds()).workArea;
  const box = panel.getBounds();
  assert.ok(box.y + box.height <= area.y + area.height, 'panel must stay inside the work area');
  assert.equal(panel.isResizable(), false);  // the resize toggle must not leave a drag edge
  await pause(600);
  assert.equal(panel.getBounds().height, fitted);  // no oscillation
  await call('azul-code:settings-set', { theme: 'dark' });
  await pause(200);
  writeFileSync(join(artifacts, 'panel-dark.png'), (await panel.webContents.capturePage()).toPNG());
  await call('azul-code:settings-set', { theme: 'light', accent: 'violet' });
  await pause(200);
  assert.equal(await panel.webContents.executeJavaScript('document.documentElement.dataset.theme'), 'light');
  assert.equal(await panel.webContents.executeJavaScript('document.documentElement.dataset.accent'), 'violet');
  assert.equal(await dashboard.webContents.executeJavaScript('document.documentElement.dataset.accent'), 'violet');
  writeFileSync(join(artifacts, 'panel-light.png'), (await panel.webContents.capturePage()).toPNG());
  await call('azul-code:settings-set', { menuBarDisplay: 'icon' });
  assert.equal(tray.getTitle(), '');
  await call('azul-code:settings-set', { menuBarDisplay: 'both' });
  assert.match(tray.getTitle(), /Codex/);
  await call('azul-code:menubar-hide');
  assert.equal(panel.isVisible(), false);
  dashboard.close();
  await until(() => dashboard.isDestroyed(), 'dashboard closed');
  assert.equal(panel.isDestroyed(), false);
  await call('azul-code:menubar-refresh');
  assert.equal(call('azul-code:menubar-get').error, null);
  tray.emit('click');
  await until(() => panel.isVisible(), 'panel opens with dashboard closed');
  assert.equal(BrowserWindow.getAllWindows().length, 1);
  await call('azul-code:open-dashboard', true);
  await until(() => BrowserWindow.getAllWindows().some(w => w !== panel), 'dashboard reopened');
  dashboard = BrowserWindow.getAllWindows().find(w => w !== panel);
  await until(async () => !dashboard.webContents.isLoading() && await dashboard.webContents.executeJavaScript('!!document.querySelector(".menubar-settings")'), 'settings opened after recreation');
  await call('azul-code:settings-set', { menuBarEnabled: false });
  assert.equal(tray.isDestroyed(), true);
  assert.equal(panel.isDestroyed(), true);
  await call('azul-code:settings-set', { menuBarEnabled: true });
  assert.equal(tray.isDestroyed(), false);
  console.log('PASS: native tray, actual preload IPC, panel render, themes, display settings, close/reopen, background refresh, disable/re-enable.');
  console.log('Screenshots: ' + artifacts);
  app.quit();
})().catch(error => { console.error(error); app.exit(1); });
