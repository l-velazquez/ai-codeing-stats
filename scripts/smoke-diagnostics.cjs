const { app, BrowserWindow, ipcMain } = require('electron');
const { mkdirSync, mkdtempSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { tmpdir } = require('node:os');

// Exercise the compiled app with isolated preferences; local usage is read-only.
const artifacts = mkdtempSync(join(tmpdir(), 'azul-diagnostics-'));
const assert = require('node:assert/strict');
const testData = join(artifacts, 'profile');
mkdirSync(testData);
app.setPath('userData', testData);
const handlers = new Map();
const handle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) => { handlers.set(channel, listener); return handle(channel, listener); };
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
  await until(() => handlers.has('tally:resources'), 'diagnostics handler');
  const first = call('tally:resources');
  assert.equal(first.cpu, null);
  assert.ok(first.memory > 0);
  await pause(1100);
  assert.equal(typeof call('tally:resources').cpu, 'number');
  const dashboard = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'azul-code');
  await until(async () => !dashboard.webContents.isLoading() && await dashboard.webContents.executeJavaScript('!!document.querySelector(".settings-launcher")'), 'dashboard');
  await until(() => call('tally:menubar-get').summary, 'initial scan');
  await dashboard.webContents.executeJavaScript('document.querySelector(".settings-launcher").click()');
  await until(async () => await dashboard.webContents.executeJavaScript('!!document.querySelector(".settings-tabs")'), 'settings');
  await dashboard.webContents.executeJavaScript('document.querySelectorAll(".settings-tabs button")[1].click()');
  await until(async () => await dashboard.webContents.executeJavaScript('!!document.querySelector(".resource-table")'), 'native diagnostics');
  assert.equal(await dashboard.webContents.executeJavaScript('document.querySelector(".modal-body").scrollWidth <= document.querySelector(".modal-body").clientWidth'), true);
  for (const theme of ['dark', 'light']) {
    await call('tally:settings-set', { theme });
    await pause(250);
    writeFileSync(join(artifacts, 'diagnostics-' + theme + '.png'), (await dashboard.webContents.capturePage()).toPNG());
  }
  console.log('Native diagnostics verified. Screenshots: ' + artifacts);
  app.quit();
})().catch(error => { console.error(error); app.exit(1); });
