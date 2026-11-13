# Compatibility and release checks

The app currently declares Nextcloud 33 only. The original 0.1.0 integration was checked on 33.0.10; standalone 0.2.0 is a local candidate. Nextcloud 34 and 35 have not been verified. Do not widen the manifest range without testing.

Files entries and handlers use public APIs. UploadPicker DOM selectors, modal classes, route context and events remain integration dependencies. App Store public-API rules require a suitability review of this approach before submission. No approval is claimed.

## Release gate

1. Run clean dependency installation, tests, build, package, PHP lint and privacy scans. Review bundle and license-notice diffs.
2. Inspect archive layout and checksums: one `files_launcher/` root, runtime allowlist only, no tests, dependencies or local notes.
3. Install the exact candidate in a fresh supported Nextcloud instance. Use disposable synthetic data for actual creation/upload testing. Cover write/read-only folders, absent context and public shares.
4. Check icon/list preference after reload, first and subsequent standard-dialog cancellation, choosing another action, upload cancellation/progress, navigation, narrow screens and themes. Check keyboard access, focus return and assistive technology separately from synthetic DOM tests.
5. Review DOM integration against App Store rules, improve upstream extension points if needed, and validate info.xml, app ID availability, author attribution, contact links, icon and screenshots.
6. Obtain an app-specific signing certificate through the official process. Keep its private key outside Git. Prepare the final runtime tree and its internal checksum manifest first, then sign with Nextcloud tooling. Do not modify any signed files afterwards; compute an external archive checksum after signing. Validate the signed artifact with Nextcloud tooling.
7. Publish reviewed source and the versioned signed package, then submit to the App Store. GitHub publication is not store acceptance.

The package script and CI create unsigned candidates. They do not request certificates, sign, create public releases or submit to the store. CI artifacts expire after seven days.

## Server updates

Back up custom_apps alongside core, config and data. Follow the official updater or manual-upgrade procedure and preserve third-party apps when replacing core files. Compare enablement, path and hashes afterwards, then repeat interaction checks. To recover the native interface, disable files_launcher and reload Files.

## References

- [App Store rules](https://docs.nextcloud.com/server/stable/developer_manual/app_publishing_maintenance/publishing.html)
- [Code signing](https://docs.nextcloud.com/server/stable/developer_manual/app_publishing_maintenance/code_signing.html)
- [Package layout](https://github.com/nextcloud/appstore/blob/master/docs/developer.rst)
