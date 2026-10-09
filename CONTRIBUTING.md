# Contributing to azul-code

Thanks for helping improve azul-code. It is a macOS Electron app built with TypeScript and React.

## Local setup

Use Node 22 (`.nvmrc`; minimum 22.12), then:

```bash
npm ci
npm run dev
```

`npm run dev:web` opens a browser preview with generated data. See [Development](docs/development.md) and [Architecture](docs/architecture.md).

## Before opening a pull request

1. Keep changes focused and explain the user-visible problem.
2. Add regression coverage for behavior changes, especially parsing, token accounting, IPC, or credentials. Use synthetic fixtures, never real transcripts.
3. Run `npm test` and `npm run build`. For native menu-bar changes, also run `npm run test:menubar` on macOS; it reads local usage but isolates preferences.
4. Update affected documentation and include screenshots for visual changes. Remove personal paths, repository names, account details, and tokens first.
5. State what you tested and any remaining limitations in the pull request.

Optional integration tests read your actual local history or authenticated GitHub account. They are opt-in and should remain disabled in CI. See [verification commands](docs/development.md#verification).

Commit `package-lock.json` with dependency changes and use `npm ci` to reproduce installs. The manifest pins direct dependency versions; the lockfile pins the full tree.

## Reporting problems

Include the app version, macOS version, CPU architecture, affected provider, steps to reproduce, and expected/actual behavior. Sanitized examples are more useful than full logs. Do not paste raw agent transcripts or credential files.

For security issues, follow [SECURITY.md](SECURITY.md) instead of filing a public issue.

## Contribution terms

Unless explicitly stated otherwise, contributions intentionally submitted for inclusion are under the project's MIT license. Preserve third-party attribution and license notices. Be respectful and keep discussions focused on the work.
