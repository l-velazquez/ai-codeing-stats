// Retakes the README screenshots from the browser preview's demo data, so no
// real usage, paths, or repositories appear. Start `npm run dev:web` first, then:
//   env -u ELECTRON_RUN_AS_NODE npx electron scripts/capture-readme-screenshots.cjs
// macOS only: windows are captured with their frame and shadow by screencapture,
// which needs Screen Recording permission for the terminal running this.
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

const PREVIEW = process.env.PREVIEW_URL || 'http://localhost:4317';
const OUT = join(process.cwd(), 'docs', 'images');
// The preview only serves demo data outside Electron, so present as Chrome.
const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const PAGES = [['overview.png', 'Overview'], ['models.png', 'Models'], ['contributions.png', 'Contributions']];

app.setPath('userData', mkdtempSync(join(tmpdir(), 'azul-code-screenshots-')));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function open(url, width, height, options = {}) {
  const window = new BrowserWindow({
    width, height, title: 'azul-code', backgroundColor: '#0b1220',
    titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 }, ...options,
  });
  window.webContents.setUserAgent(CHROME_UA);
  await window.loadURL(url);
  await pause(1500);
  return window;
}

function capture(window, file) {
  const id = window.getMediaSourceId().split(':')[1];
  execFileSync('/usr/sbin/screencapture', ['-x', '-l', id, join(OUT, file)]);
  console.log(`wrote docs/images/${file}`);
}

app.whenReady().then(async () => {
  try {
    const dashboard = await open(`${PREVIEW}/`, 1180, 860);
    for (const [file, label] of PAGES) {
      await dashboard.webContents.executeJavaScript(
        `[...document.querySelectorAll('nav button, aside button, a')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(label)}))?.click()`,
      );
      await pause(1200);
      capture(dashboard, file);
    }
    const panel = await open(`${PREVIEW}/?view=menubar`, 360, 640, { frame: false, transparent: true, titleBarStyle: 'default', hasShadow: true });
    capture(panel, 'menu-bar.png');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
  app.exit();
});
