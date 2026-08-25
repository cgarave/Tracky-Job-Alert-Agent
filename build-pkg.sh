#!/usr/bin/env bash
# =============================================================================
#  build-pkg.sh — Builds JobAlertAgent.pkg
#
#  Run this from the project root:
#    bash build-pkg.sh
#
#  Output: dist/JobAlertAgent.pkg
#  Share this .pkg file with anyone on macOS — they double-click to install.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/pkg-build"
DIST_DIR="$SCRIPT_DIR/dist"
PAYLOAD_DIR="$BUILD_DIR/payload"
INSTALL_DIR="$PAYLOAD_DIR/usr/local/share/jobagent"
PKG_VERSION="1.0"
PKG_IDENTIFIER="com.jobagent"

GREEN="\033[0;32m"
NC="\033[0m"
info() { echo -e "${GREEN}▸${NC}  $*"; }

echo ""
echo "  ┌─────────────────────────────────────┐"
echo "  │        Building Tracky .pkg         │"
echo "  └─────────────────────────────────────┘"
echo ""

# ── 1. Clean previous build ──────────────────────────────────────────────────
info "Cleaning previous build..."
rm -rf "$PAYLOAD_DIR" "$DIST_DIR"
mkdir -p "$INSTALL_DIR/job_agent/scrapers"
mkdir -p "$DIST_DIR"

# ── 2. Copy project files into payload ──────────────────────────────────────
info "Copying project files..."

# Core agent files
cp "$SCRIPT_DIR/job_agent/main.py"             "$INSTALL_DIR/job_agent/"
cp "$SCRIPT_DIR/job_agent/menu_bar.py"         "$INSTALL_DIR/job_agent/"
cp "$SCRIPT_DIR/job_agent/commander.py"        "$INSTALL_DIR/job_agent/"
cp "$SCRIPT_DIR/job_agent/listener.py"         "$INSTALL_DIR/job_agent/"
cp "$SCRIPT_DIR/job_agent/notifier.py"         "$INSTALL_DIR/job_agent/"
cp "$SCRIPT_DIR/job_agent/db.py"               "$INSTALL_DIR/job_agent/"
cp "$SCRIPT_DIR/job_agent/profile_manager.py"  "$INSTALL_DIR/job_agent/"
cp "$SCRIPT_DIR/job_agent/dashboard_server.py" "$INSTALL_DIR/job_agent/"
cp "$SCRIPT_DIR/job_agent/ai_parser.py"       "$INSTALL_DIR/job_agent/"


# Applier module
mkdir -p "$INSTALL_DIR/job_agent/applier"
cp -r "$SCRIPT_DIR/job_agent/applier/"* "$INSTALL_DIR/job_agent/applier/"

# Static Web GUI bundle (compiled Next.js + shadcn UI)
mkdir -p "$INSTALL_DIR/job_agent/static"
cp -r "$SCRIPT_DIR/job_agent/static/"* "$INSTALL_DIR/job_agent/static/"

# Scrapers
cp "$SCRIPT_DIR/job_agent/scrapers/__init__.py"   "$INSTALL_DIR/job_agent/scrapers/"
cp "$SCRIPT_DIR/job_agent/scrapers/indeed.py"     "$INSTALL_DIR/job_agent/scrapers/"
cp "$SCRIPT_DIR/job_agent/scrapers/jobstreet.py"  "$INSTALL_DIR/job_agent/scrapers/"
cp "$SCRIPT_DIR/job_agent/scrapers/onlinejobs.py" "$INSTALL_DIR/job_agent/scrapers/"

# Requirements & Icon
cp "$SCRIPT_DIR/requirements.txt" "$INSTALL_DIR/"
if [ -f "$SCRIPT_DIR/logos/Tracky.icns" ]; then
    cp "$SCRIPT_DIR/logos/Tracky.icns" "$INSTALL_DIR/Tracky.icns"
fi


# NOTE: config.json is NOT included — postinstall creates it per-user

# ── 3. Set permissions ───────────────────────────────────────────────────────
info "Setting permissions..."
find "$PAYLOAD_DIR" -type d -exec chmod 755 {} \;
find "$PAYLOAD_DIR" -type f -exec chmod 644 {} \;
# job_agent dir must be writable by the user (config.json, seen_jobs.db, status.json, etc.)
chmod 777 "$INSTALL_DIR/job_agent"

# ── 4. Make scripts executable ───────────────────────────────────────────────
info "Making installer scripts executable..."
chmod +x "$BUILD_DIR/scripts/preinstall"
chmod +x "$BUILD_DIR/scripts/postinstall"

# ── 5. Build the component package ──────────────────────────────────────────
info "Running pkgbuild..."
pkgbuild \
    --root        "$PAYLOAD_DIR" \
    --scripts     "$BUILD_DIR/scripts" \
    --identifier  "$PKG_IDENTIFIER" \
    --version     "$PKG_VERSION" \
    --install-location "/" \
    "$DIST_DIR/JobAgent.pkg"

# ── 6. Build the final installer with welcome screen ────────────────────────
info "Running productbuild..."
productbuild \
    --distribution "$BUILD_DIR/Distribution.xml" \
    --resources    "$BUILD_DIR/resources" \
    --package-path "$DIST_DIR" \
    "$DIST_DIR/JobAlertAgent.pkg"

# Clean up intermediate component pkg
rm -f "$DIST_DIR/JobAgent.pkg"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "  ✅  Done! Installer created at:"
echo ""
echo "      $DIST_DIR/JobAlertAgent.pkg"
echo ""
echo "  Share this file with anyone on macOS."
echo "  They double-click it to install — no Terminal needed."
echo ""
echo "  File size: $(du -sh "$DIST_DIR/JobAlertAgent.pkg" | cut -f1)"
echo ""
