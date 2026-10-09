# Public release checklist

[Documentation index](index.md)

Publishing the source and distributing a signed macOS installer are separate steps. Source can be published before installers are available; the README provides a source-build path.

## 1. Prepare the source

- [ ] Merge the intended app changes and release-preparation changes into `main`. Confirm the README, license, and app identity match the default branch.
- [ ] Run `npm ci`, `npm test`, `npm run build`, and `npm audit --audit-level=high` from a clean checkout using Node 22.
- [ ] Scan all branches and tags with [Gitleaks](https://github.com/gitleaks/gitleaks): `gitleaks git . --log-opts="--all" --redact`. CI scans fetched history too. Inspect uncommitted files before committing; history scans do not cover them.
- [ ] Review commit author/committer emails, old file contents, branches, tags, issues, pull requests, and existing Actions logs/artifacts for information that should remain private. A clean secret scan does not establish that these contain no personal information.
- [ ] Review screenshot contents. The README intentionally includes Overview, Models, and the menu bar companion; do not add real project/session/contribution screenshots without reviewing paths and activity details.
- [ ] Preserve `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `licenses/`. Check attribution when adding copied code, fonts, or artwork.

Useful local history checks:

```bash
git log --all --format='%an <%ae> | %cn <%ce>' | sort -u
git log --all --format= --name-only | sort -u
git status --short
```

Changing Git author settings only affects future commits. Existing personal email addresses remain in history unless it is deliberately rewritten. Coordinate any rewrite before publishing; do not force-push it casually.

## 2. Configure GitHub and publish the source

The repository currently uses `l-velazquez/ai-codeing-stats`. The display/product name is azul-code. Renaming the repository is optional; if renamed, update manifest URLs, README clone instructions, and security-report links together.

Suggested description:

> Local-first macOS dashboard for AI coding usage, subscription allowances, and GitHub contributions.

Suggested topics: `macos`, `electron`, `typescript`, `ai`, `developer-tools`, `usage-tracking`, `codex`, `claude-code`, `opencode`.

- [ ] Confirm the intended source and media are on `main` and the CI jobs are green.
- [ ] Enable private vulnerability reporting and verify the **Report a vulnerability** link from `SECURITY.md`. If unavailable while private, enable it immediately after changing visibility.
- [ ] Enable available Dependabot alerts, secret scanning, and push protection.
- [ ] Protect `main` with pull requests and the `Test and build (macOS)` and `Scan Git history for secrets` status checks. Choose review requirements appropriate for the number of maintainers.
- [ ] Review the repository visibility-change notice, then change visibility to public only after the owner approves publishing the reviewed source and history.
- [ ] Verify the public README, image rendering, license detection, issue templates, and clone instructions while signed out.

`package.json` intentionally keeps `"private": true`: this prevents accidental npm registry publication and does not prevent GitHub source publication or desktop packaging.

## 3. Build macOS installers

For local testing only:

```bash
npm run dist:mac
```

This creates DMG/ZIP artifacts for the current machine's architecture in `release/`. An unsigned build is not a notarized release. The repository has no automated signing/notarization or release-upload workflow and no automatic updater.

For public installer distribution:

1. Choose and document supported macOS versions and CPU architectures. Test each architecture you distribute; do not label an arm64-only build universal.
2. Use an Apple Developer **Developer ID Application** signing identity and notarization credentials. Keep certificates/passwords outside the repository, using local Keychain or protected release secrets.
3. Configure signing and notarization using the current [electron-builder macOS guide](https://www.electron.build/mac.html) and [Apple notarization documentation](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution). Require signing so missing credentials fail the release build (`forceCodeSigning`).
4. Build from the exact reviewed commit with `--publish never`. Keep release jobs that access signing credentials separate from pull-request jobs.
5. Verify the signed app and stapled notarization ticket, then test the downloaded artifact on a clean Mac:

```bash
codesign --verify --deep --strict --verbose=2 /path/to/azul-code.app
spctl --assess --type execute --verbose=2 /path/to/azul-code.app
xcrun stapler validate /path/to/azul-code.app
```

6. Exercise launch, source discovery, menu bar, appearance, GitHub, and quit behavior. Confirm that signing/notarization succeeds without instructing users to disable Gatekeeper.
7. Verify packaged license and notice files. Produce SHA-256 checksums for the final DMG/ZIP files with `shasum -a 256`.
8. Set the release version in both package files, create the matching tag on the reviewed commit, and prepare release notes listing requirements, changes, known limitations, architecture, and checksums.
9. Review the release artifacts before publishing a GitHub Release. Add a README download link only when a tested artifact exists.

The [native smoke checks](development.md#verification) help validate Electron behavior, but do not replace testing a downloaded, signed installer.
