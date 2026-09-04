#!/usr/bin/env bash
# =============================================================================
#  Stop Tracky.command
#  Double-clickable script to turn off all Tracky daemons and background processes.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/job_agent/config.json"
DAEMON_PLIST="$HOME/Library/LaunchAgents/com.jobagent.plist"
MENUBAR_PLIST="$HOME/Library/LaunchAgents/com.jobagent.menubar.plist"

echo ""
echo "  🛑 Stopping Tracky..."
echo ""

# 1. Unload LaunchAgents from launchd
if [ -f "$DAEMON_PLIST" ]; then
    launchctl unload "$DAEMON_PLIST" 2>/dev/null || true
fi

if [ -f "$MENUBAR_PLIST" ]; then
    launchctl unload "$MENUBAR_PLIST" 2>/dev/null || true
fi

# 2. Terminate any active Tracky processes
pkill -f "job_agent/main.py" 2>/dev/null || true
pkill -f "job_agent/menu_bar.py" 2>/dev/null || true
pkill -f "job_agent/dashboard_server.py" 2>/dev/null || true

# 3. Ensure config state is paused
if [ -f "$CONFIG_FILE" ]; then
    python3 -c "
import json
try:
    with open('$CONFIG_FILE') as f:
        cfg = json.load(f)
    cfg['paused'] = True
    with open('$CONFIG_FILE', 'w') as f:
        json.dump(cfg, f, indent=2)
except Exception:
    pass
" 2>/dev/null || true
fi

# 4. Notify macOS
osascript -e 'display notification "All Tracky daemons and menu bar processes stopped." with title "Tracky Stopped" subtitle "🛑 Offline"' 2>/dev/null || true

echo "  ✅ All Tracky daemons and menu bar processes have been stopped."
echo ""
