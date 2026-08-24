#!/usr/bin/env bash
# =============================================================================
#  start.sh / Start Tracky.command
#  Double-clickable script to start both the scraper daemon & menu bar app.
# =============================================================================
set -euo pipefail

DAEMON_PLIST="$HOME/Library/LaunchAgents/com.jobagent.plist"
MENUBAR_PLIST="$HOME/Library/LaunchAgents/com.jobagent.menubar.plist"

# Load background scraper daemon if not loaded
if [ -f "$DAEMON_PLIST" ]; then
    launchctl load "$DAEMON_PLIST" 2>/dev/null || true
fi

# Load & start menu bar app
if [ -f "$MENUBAR_PLIST" ]; then
    launchctl load "$MENUBAR_PLIST" 2>/dev/null || true
    launchctl start com.jobagent.menubar 2>/dev/null || true
fi

# Send macOS notification
osascript -e 'display notification "Tracky scraper and menu bar are now active." with title "Tracky Started" subtitle "🐶 Online"' 2>/dev/null || true

echo "Tracky started successfully."
