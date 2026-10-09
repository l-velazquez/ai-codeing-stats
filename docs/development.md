# Development and maintenance

[Documentation index](index.md)

## Commands

Use Node 22 (minimum 22.12; see `.nvmrc`). Run commands from the repository root after `npm ci`. Direct dependencies are pinned, and `package-lock.json` records the complete tree.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Electron development with renderer hot reload |
| `npm run dev:web` | Browser UI with generated data on port 4317 |
| `npm run typecheck` | TypeScript validation without emitting files |
| `npm test` | Node/shared and jsdom renderer tests |
| `npm run test:watch` | Interactive test watch mode |
| `npm run build` | Typecheck, electron-vite production build, build verification |
| `npm run verify:build` | Validate existing compiled preload and tray assets |
| `npm run preview` | Launch the built Electron app |
| `npm run test:menubar` | Build and run native macOS menu bar smoke checks |
| `npm run dist:mac` | Build and package DMG/ZIP into `release/` |

Build output lives in `out/main`, `out/preload`, and `out/renderer`. `electron.vite.config.ts` defines desktop bundling; `vite.config.ts` defines browser preview. `@shared` and `@renderer` aliases are used across build/test configuration. React pages use page-specific CSS alongside shared theme tokens.

## Browser preview

The browser bridge supplies generated data when Electron's bridge is absent. Use these URLs to review empty and failure states without modifying real agent history:

| URL | State |
| --- | --- |
| `http://localhost:4317/` | Populated demo |
| `http://localhost:4317/?state=fresh` | No connected sources |
| `http://localhost:4317/?state=waiting` | Claude capture configured, first report pending |
| `http://localhost:4317/?state=empty` | Connected sources with no usage |
| `http://localhost:4317/?state=error` | Scan error and GitHub setup/error scenario |
| `http://localhost:4317/?view=menubar` | Menu bar panel preview |
| `http://localhost:4317/?view=menubar&state=waiting` | Combined panel and state preview |

Browser previews cannot verify native tray behavior, real filesystem ingestion, or the Electron preload. Use desktop checks for those boundaries.

## Verification

For application changes, run:

```bash
npm run typecheck
npm test
npm run build
```

Vitest separates Node tests for main/shared logic from jsdom tests for renderer components and hooks. Existing coverage includes transcript normalization, source aggregation, midnight attribution, projection, preferences, Claude installation, GitHub month logic, async state, clipboard behavior, modals, and menu bar formatting.

Optional local integrations read the current machine or authenticated account. Inspect their guards before running:

```bash
RUN_LOCAL_SCAN=1 npx vitest --config vitest.config.ts run src/main/scanner.integration.test.ts
```

To run the authenticated GitHub integration (makes real API reads):

```bash
RUN_GITHUB_SCAN=1 npx vitest --config vitest.config.ts run src/main/github.integration.test.ts
```

For tray changes, run `npm run test:menubar` on macOS. It uses isolated temporary preferences but reads real local usage sources. It checks the native tray/preload, panel layout, appearance/display preferences, background refresh with the dashboard closed, Settings reopening, and disabling/re-enabling the companion. Screenshots are written to the temporary location printed by the script.

For docs-only changes, check relative links and code references; rebuilding the app is unnecessary unless you also change application behavior.

## Adding or changing features

- **Provider ingestion:** start with `UsageRecord` and `Provider` in shared types, add parsing/fixtures, then wire scanner source status and aggregation. Update provider labels, marks, UI lists, and docs. Do not assume new providers report inclusive input or per-request costs.
- **Pricing:** edit `src/shared/pricing.ts`, verify rates and context-tier assumptions against official provider material, and record the verification date. Test cache buckets, unknown models, reported costs, and threshold boundaries. Do not silently map an unknown model to a guessed rate.
- **Pages:** register navigation in `app/routes.ts`, render the page in `App.tsx`, and declare whether the shared range applies. Use the refresh provider when a page owns a different refresh action.
- **Preferences:** update the shared schema/defaults/normalizer, bridge consumers, and tests. Consider initial paint and both windows when changing appearance. Preserve older internal paths unless an explicit migration is implemented.
- **IPC:** update shared types, preload methods, and main handlers together. Validate new inputs in main and return listener cleanup functions for events.

## Icons and packaging

The blue six-arm identity uses `resources/icon.svg` and simplified `resources/icon-small.svg` for small sizes. Regenerate assets after editing:

```bash
./scripts/generate-icons.sh
```

The script needs `rsvg-convert` from librsvg plus macOS icon tools. It generates the iconset, `build/icon.icns`, app PNG, and tray templates. Keep required standard/Retina PNGs available to packaging and review small-size legibility.

`package.json` holds version, product name, app ID, packaging targets, and included files. `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `licenses/` are bundled. Distribution currently has DMG and ZIP targets; signing, notarization, publishing, and automatic updates are not configured as a complete release workflow in this repository. Validate the actual packaged app before sharing a release; follow [the release checklist](releasing.md).

## Keep the docs accurate

Update the user guide for behavior/UI changes, the data reference for calculations or ingestion changes, privacy for new reads/writes/network calls, and architecture for new process boundaries. Link to source rather than duplicating long model-rate tables. Document limitations alongside the affected feature, especially changes that can alter totals.
