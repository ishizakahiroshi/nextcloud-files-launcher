# Files Launcher

A compact creation and upload launcher for the Nextcloud Files web interface. [日本語](README.ja.md)

Open a nine-dot button to choose the creation actions available in the current folder. Switch between small icons and a list. Cancelling a standard creation dialog leaves the launcher open so you can choose another action.

## Status

Standalone **0.2.0 is an unreleased candidate**, declaring compatibility with **Nextcloud 33–35**. Automated browser tests on disposable Nextcloud 33.0.10, 34.0.5 and 35.0.3 instances exercised the launcher, view preference, cancellation, file upload and folder creation. The same checks passed with the compatibility declaration included in the package. The app is not yet published in the App Store.

## Features

- Reuses existing creation entries and handlers, current-folder context and permissions.
- Compact icon or list view, with the preference stored in the current browser.
- Reuses native file/folder upload inputs, progress and cancellation.
- English interface with Japanese translation. Provider action labels retain their own translations.
- Keeps the native control when context is unavailable and on public shares.

The app changes the web interface. It does not add a storage service or send files to an external service. Your view preference is stored locally as `files_launcher:view:v1`.

## Build and install a candidate

Development requires Node.js 24 and npm. The installed app does not need Node.js.

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run package
```

Verify `build/SHA256SUMS.txt`. Extract the tar.gz into a writable custom-apps directory configured in Nextcloud's `apps_paths`. The archive contains one directory, `files_launcher/`, matching the app ID. Set ownership to the web-server user, directories to 755 and files to 644. From the Nextcloud installation:

```sh
sudo -u www-data php occ app:enable files_launcher
```

Reload Files and open a folder with creation permission. To return to the native interface, run `sudo -u www-data php occ app:disable files_launcher` and reload. Keep the previous package before updating. There is no App Store update channel until a signed release is published.

## Development and compatibility

`npm run build` generates the production bundle and a separate synthetic browser fixture. Serve the repository locally and open `tests/fixture.html` to inspect the fixture. Development sources, dependencies and tests are excluded from installation packages.

[View a synthetic Japanese fixture screenshot](docs/screenshots/fixture-ja.jpg). The screenshot does not represent a live server.

The app uses public Files APIs plus DOM hooks into the native UploadPicker and modal classes. Those hooks are a compatibility risk and need a suitability review against App Store rules. Tests on specific versions do not establish compatibility with every configuration or App Store acceptance.

See [maintenance and release checks](docs/maintenance.md), [contributing](CONTRIBUTING.md), [security reporting](SECURITY.md) and the [changelog](CHANGELOG.md).

## License

AGPL-3.0-or-later. Packages include `LICENSE` and dependency notices in `js/main.js.LICENSE.txt`. Initial contribution attribution is retained in `NOTICE`.
