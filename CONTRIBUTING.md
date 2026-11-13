# Contributing

Use synthetic folders and files in tests and screenshots. Never submit credentials, actual file listings or deployment configuration.

Run `npm ci --ignore-scripts`, `npm test`, `npm run build` and `npm run package`. Commit source, lockfile and generated production bundle together. The fixture bundle is for local UI checks and is excluded from installation packages.

Changing Nextcloud compatibility requires integration testing on that version. Cover permissions, icon/list preference, cancellation of first and subsequent creation dialogs, upload cancellation/progress, folder navigation, narrow screens and light/dark themes. State local, synthetic and real Nextcloud results separately.

Preserve the app ID `files_launcher`, license and original contribution attribution. See [security reporting](SECURITY.md).
