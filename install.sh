#!/bin/sh
# Installs the latest Drift release on macOS or Linux.
#   curl -fsSL https://raw.githubusercontent.com/dor2500/drift-browser/main/install.sh | sh
set -eu

REPO="dor2500/drift-browser"
API="https://api.github.com/repos/$REPO/releases/latest"

asset_url() {
  # Prints the download URL of the first release asset matching $1 (a grep pattern).
  curl -fsSL -H "User-Agent: drift-installer" "$API" \
    | grep -o '"browser_download_url": *"[^"]*"' \
    | sed 's/.*"\(https[^"]*\)"/\1/' \
    | grep -E "$1" | head -n 1
}

verify() {
  # Verify a downloaded file ($1) against the release's SHA256SUMS before using
  # it. $2 is the asset's filename as it appears in the manifest. Fails closed on
  # mismatch or when the file is missing from an existing manifest.
  file="$1"; name="$2"
  sums_url=$(asset_url '/SHA256SUMS$')
  if [ -z "$sums_url" ]; then
    echo "WARNING: this release has no SHA256SUMS; skipping integrity check." >&2
    return 0
  fi
  expected=$(curl -fsSL -H "User-Agent: drift-installer" "$sums_url" \
    | grep -E "[[:space:]]${name}\$" | awk '{print $1}' | head -n 1)
  if [ -z "$expected" ]; then
    echo "ERROR: $name is not listed in SHA256SUMS; refusing to install." >&2; exit 1
  fi
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$file" | awk '{print $1}')
  else
    actual=$(shasum -a 256 "$file" | awk '{print $1}')
  fi
  if [ "$expected" != "$actual" ]; then
    echo "ERROR: checksum mismatch for $name (expected $expected, got $actual). Refusing to install." >&2
    exit 1
  fi
  echo "Checksum verified for $name."
}

case "$(uname -s)" in
  Darwin)
    url=$(asset_url '\.dmg$')
    [ -n "$url" ] || { echo "No macOS build found in the latest release." >&2; exit 1; }
    tmp=$(mktemp -d)
    echo "Downloading $(basename "$url")..."
    curl -fL --progress-bar "$url" -o "$tmp/Drift.dmg"
    mount=$(hdiutil attach -nobrowse -quiet "$tmp/Drift.dmg" | tail -n 1 | cut -f3)
    rm -rf "/Applications/Drift.app"
    cp -R "$mount/Drift.app" /Applications/
    hdiutil detach -quiet "$mount"
    rm -rf "$tmp"
    # Builds are not notarized yet, so clear the download quarantine flag.
    xattr -dr com.apple.quarantine /Applications/Drift.app 2>/dev/null || true
    echo "Drift is installed in /Applications."
    open -a Drift
    ;;
  Linux)
    url=$(asset_url '\.AppImage$')
    [ -n "$url" ] || { echo "No Linux build found in the latest release." >&2; exit 1; }
    bin="$HOME/.local/bin"
    mkdir -p "$bin" "$HOME/.local/share/applications"
    echo "Downloading $(basename "$url")..."
    curl -fL --progress-bar "$url" -o "$bin/drift.AppImage"
    chmod +x "$bin/drift.AppImage"
    cat > "$HOME/.local/share/applications/drift.desktop" <<EOF
[Desktop Entry]
Name=Drift
Comment=Web browser
Exec=$bin/drift.AppImage %U
Terminal=false
Type=Application
Categories=Network;WebBrowser;
MimeType=text/html;x-scheme-handler/http;x-scheme-handler/https;
EOF
    echo "Drift is installed at $bin/drift.AppImage and in your app menu."
    ;;
  *)
    echo "On Windows, run in PowerShell:  irm https://raw.githubusercontent.com/$REPO/main/install.ps1 | iex" >&2
    exit 1
    ;;
esac
