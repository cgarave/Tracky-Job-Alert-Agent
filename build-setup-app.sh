#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/dist/Tracky Setup.app"
CONTENTS="$APP_DIR/Contents"

rm -rf "$APP_DIR"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"

ARM_BINARY="$ROOT_DIR/dist/TrackySetup-arm64"
INTEL_BINARY="$ROOT_DIR/dist/TrackySetup-x86_64"
swiftc -parse-as-library -target arm64-apple-macosx12.0 -framework SwiftUI -framework AppKit "$ROOT_DIR/setup/TrackySetup/main.swift" -o "$ARM_BINARY"
swiftc -parse-as-library -target x86_64-apple-macosx12.0 -framework SwiftUI -framework AppKit "$ROOT_DIR/setup/TrackySetup/main.swift" -o "$INTEL_BINARY"
lipo -create "$ARM_BINARY" "$INTEL_BINARY" -output "$CONTENTS/MacOS/TrackySetup"
rm -f "$ARM_BINARY" "$INTEL_BINARY"

cp "$ROOT_DIR/dist/JobAlertAgent.pkg" "$CONTENTS/Resources/JobAgent.pkg"
cp "$ROOT_DIR/job_agent/python_runtime.py" "$CONTENTS/Resources/python_runtime.py"

cat > "$CONTENTS/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDisplayName</key><string>Tracky Setup</string>
  <key>CFBundleExecutable</key><string>TrackySetup</string>
  <key>CFBundleIdentifier</key><string>com.jobagent.setup</string>
  <key>CFBundleName</key><string>Tracky Setup</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>
PLIST

echo "Built $APP_DIR"

DMG_PATH="$ROOT_DIR/dist/Tracky-Setup.dmg"
rm -f "$DMG_PATH"
hdiutil create -volname "Tracky Setup" -srcfolder "$APP_DIR" -ov -format UDZO "$DMG_PATH" >/dev/null
echo "Built $DMG_PATH"
