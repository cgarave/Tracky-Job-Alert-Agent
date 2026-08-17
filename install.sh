#!/usr/bin/env bash
# =============================================================================
#  Job Agent — One-Command Installer
#  Run this once from the project root:  bash install.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$SCRIPT_DIR/job_agent"
CONFIG_FILE="$AGENT_DIR/config.json"
PLIST_NAME="com.jobagent"
MENUBAR_PLIST_NAME="com.jobagent.menubar"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
MENUBAR_PLIST_DEST="$HOME/Library/LaunchAgents/$MENUBAR_PLIST_NAME.plist"
LOG_FILE="$HOME/Library/Logs/jobagent.log"
MENUBAR_LOG_FILE="$HOME/Library/Logs/jobagent-menubar.log"

# Colors
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

info()    { echo -e "${GREEN}✔${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
section() { echo -e "\n${GREEN}▸${NC}  $*"; }

echo ""
echo "  ╔══════════════════════════════════╗"
echo "  ║   🤖  PH Job Alert Agent Setup   ║"
echo "  ╚══════════════════════════════════╝"
echo ""

# ── 1. Python check ──────────────────────────────────────────────────────────
section "Checking Python 3..."
PYTHON=$(which python3 2>/dev/null || echo "")
if [ -z "$PYTHON" ]; then
  echo -e "${RED}✘${NC}  python3 not found. Install it from https://python.org and re-run this script."
  exit 1
fi
PY_VERSION=$("$PYTHON" --version 2>&1)
info "$PY_VERSION found at $PYTHON"

# ── 2. Install Python dependencies ───────────────────────────────────────────
section "Installing Python dependencies (including rumps for menu bar)..."
"$PYTHON" -m pip install -r "$SCRIPT_DIR/requirements.txt" --quiet
info "Dependencies installed."

# ── 3. Install Playwright + Chromium ─────────────────────────────────────────
section "Installing Playwright headless browser (Chromium)..."
"$PYTHON" -m playwright install chromium
info "Playwright ready."

# ── 4. Get recipient ─────────────────────────────────────────────────────────
section "iMessage recipient setup"
echo ""
echo "  Enter your own phone number or Apple ID email."
echo "  Messages will be sent to this address (it should be registered in Messages.app)."
echo ""
read -rp "  Phone number or Apple ID: " RECIPIENT
echo ""

if [ -z "$RECIPIENT" ]; then
  echo -e "${RED}✘${NC}  No recipient entered. Aborting."
  exit 1
fi

# ── 5. Write config.json ─────────────────────────────────────────────────────
section "Writing config.json..."
if [ -f "$CONFIG_FILE" ]; then
  warn "config.json already exists — updating recipient only."
  "$PYTHON" - <<PYEOF
import json
with open("$CONFIG_FILE") as f:
    cfg = json.load(f)
cfg["recipient"] = "$RECIPIENT"
with open("$CONFIG_FILE", "w") as f:
    json.dump(cfg, f, indent=2)
PYEOF
else
  cat > "$CONFIG_FILE" <<JSONEOF
{
  "recipient": "$RECIPIENT",
  "keywords": [
    "software engineer",
    "frontend engineer",
    "web developer",
    "ai engineer",
    "full stack developer",
    "react developer"
  ],
  "location": "Philippines",
  "check_interval_minutes": 60,
  "max_results_per_keyword": 10,
  "paused": false
}
JSONEOF
fi
info "config.json saved."

# ── 6. Write daemon launchd plist ────────────────────────────────────────────
section "Creating daemon LaunchAgent..."
mkdir -p "$HOME/Library/LaunchAgents"

cat > "$PLIST_DEST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$AGENT_DIR/main.py</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$AGENT_DIR</string>
    <key>StandardOutPath</key>
    <string>$LOG_FILE</string>
    <key>StandardErrorPath</key>
    <string>$LOG_FILE</string>
</dict>
</plist>
PLISTEOF
info "Daemon plist written."

# ── 7. Write menu bar launchd plist ──────────────────────────────────────────
section "Creating menu bar LaunchAgent..."

cat > "$MENUBAR_PLIST_DEST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$MENUBAR_PLIST_NAME</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON</string>
        <string>$AGENT_DIR/menu_bar.py</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>$AGENT_DIR</string>
    <key>StandardOutPath</key>
    <string>$MENUBAR_LOG_FILE</string>
    <key>StandardErrorPath</key>
    <string>$MENUBAR_LOG_FILE</string>
</dict>
</plist>
PLISTEOF
info "Menu bar plist written."

# ── 8. Load both daemons ─────────────────────────────────────────────────────
section "Loading agents with launchctl..."
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"
info "Daemon loaded."

launchctl unload "$MENUBAR_PLIST_DEST" 2>/dev/null || true
launchctl load "$MENUBAR_PLIST_DEST"
info "Menu bar app loaded."

# ── 9. Send welcome iMessage ─────────────────────────────────────────────────
section "Sending test iMessage to $RECIPIENT..."
sleep 3
"$PYTHON" - <<PYEOF
import sys
sys.path.insert(0, "$AGENT_DIR")
from notifier import send_imessage
ok = send_imessage(
    "$RECIPIENT",
    "\U0001f44b Job Agent is online!\n\nText /help to see all commands, or click the \U0001f916 icon in your menu bar."
)
if not ok:
    print("  Warning: Test message may not have sent. Make sure Messages.app is open.")
PYEOF

# ── 10. Summary ──────────────────────────────────────────────────────────────
echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║  ✅  Setup complete!                             ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""
echo "  📱  Check your iPhone — you should have a welcome iMessage."
echo "  🤖  Look for the 🤖 icon in your Mac menu bar."
echo "  📄  Daemon logs:   tail -f $LOG_FILE"
echo "  📄  Menu bar logs: tail -f $MENUBAR_LOG_FILE"
echo ""
echo -e "  ${YELLOW}⚠️   REQUIRED: Grant Full Disk Access to Python${NC}"
echo "      System Settings → Privacy & Security → Full Disk Access"
echo "      Click + → Cmd+Shift+G → paste: /Library/Frameworks/Python.framework/Versions/3.11/bin"
echo "      Select python3 → Open → toggle ON"
echo ""
echo "  Text /help to yourself or click the 🤖 menu bar icon to get started!"
echo ""
