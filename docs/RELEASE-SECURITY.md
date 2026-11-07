# Release integrity & code signing

Drift's release pipeline (`.github/workflows/release.yml`) now ships a
`SHA256SUMS` manifest and supports optional code signing / notarization. This
is what protects users who install via `install.sh` / `install.ps1` and via the
built-in auto-updater.

## SHA256SUMS (always on)

After the desktop and Android builds finish, the `checksums` job downloads every
release asset, computes `sha256sum` over all of them, and uploads a `SHA256SUMS`
file to the release. The installers verify the file they downloaded against it
**before** running it, and fail closed on a mismatch:

- `install.ps1` — looks up the `Drift-Setup-*.exe` line and compares
  `Get-FileHash -Algorithm SHA256`.
- `install.sh` — looks up the `.dmg` / `.AppImage` line and compares
  `sha256sum` / `shasum -a 256`.

If a release has no `SHA256SUMS` (older releases), the installers print a warning
and continue; any release built by the current workflow will have it.

This defends against a tampered *individual asset* (e.g. a replaced
`browser_download_url` target). It is not a substitute for code signing, because
the manifest itself is served from the same release — a full release compromise
could replace both. Code signing (below) closes that gap.

## Code signing & notarization (optional — needs your certificates)

The build step passes these repository secrets to `electron-builder` when they
are set. Leave them unset and builds are produced unsigned, exactly as before.

### Windows (Authenticode)

| Secret | Value |
| --- | --- |
| `DRIFT_CSC_LINK` | Base64 of your code-signing `.pfx`/`.p12` |
| `DRIFT_CSC_KEY_PASSWORD` | The certificate's password |

`base64 -w0 cert.pfx` (Linux) or `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))` (PowerShell).

### macOS (Developer ID + notarization)

| Secret | Value |
| --- | --- |
| `DRIFT_CSC_LINK` | Base64 of your Developer ID Application `.p12` |
| `DRIFT_CSC_KEY_PASSWORD` | The `.p12` password |
| `DRIFT_APPLE_ID` | Your Apple ID email |
| `DRIFT_APPLE_APP_PASSWORD` | An app-specific password for that Apple ID |
| `DRIFT_APPLE_TEAM_ID` | Your Apple Developer Team ID |

`CSC_IDENTITY_AUTO_DISCOVERY` is set to `true` only when `DRIFT_CSC_LINK` is
present, so unconfigured forks still build.

### Once macOS builds are notarized

Remove the Gatekeeper-quarantine line in `install.sh`:

```sh
xattr -dr com.apple.quarantine /Applications/Drift.app
```

It exists only so unsigned builds launch without a Gatekeeper block. A notarized
app does not need it, and keeping it would needlessly weaken Gatekeeper. Until
then the installer still verifies the download's SHA-256 before touching it.

## Android

APKs are already signed with the keystore in `DRIFT_KEYSTORE_B64` /
`DRIFT_KEYSTORE_PASSWORD`, and Android enforces the signature on install/update.
The APKs are also covered by `SHA256SUMS`.
