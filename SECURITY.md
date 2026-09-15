# Security policy

## Supported versions

Security fixes target the latest source on `main`. This early-stage project does not maintain older release branches or promise a response deadline.

## Report a vulnerability privately

Use GitHub's [Report a vulnerability](https://github.com/l-velazquez/ai-codeing-stats/security/advisories/new) form when private vulnerability reporting is enabled. Include the affected version/commit, reproduction steps using synthetic data, impact, and a suggested fix if available.

If the private form is unavailable, open an issue containing only a request for a private security contact. Do not post exploit details, tokens, transcript contents, private repository information, or personal paths in a public issue.

## Security boundaries

azul-code reads local agent records and optionally calls the GitHub API using existing authentication. Connecting Claude allowance capture changes a local status-line configuration. Read [Privacy and local storage](docs/privacy.md) for exact behavior.

Treat agent records, workspace paths, GitHub responses, and renderer IPC arguments as untrusted input. Keep credentials out of logs and renderer state, validate privileged operations in the main process, and preserve sandboxing and context isolation.

A dependency audit or secret scan is a useful check, not a guarantee that the app has no vulnerabilities. Release maintainers should follow [the release checklist](docs/releasing.md).
