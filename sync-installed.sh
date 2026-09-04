#!/usr/bin/env bash
# =============================================================================
#  sync-installed.sh — Safely sync code and static assets to /usr/local/share/jobagent
#  WITHOUT touching or overwriting seen_jobs.db, config.json, or profile.json
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="/usr/local/share/jobagent/job_agent"

mkdir -p "$TARGET_DIR/scrapers" "$TARGET_DIR/static" /usr/local/share/jobagent/extension

# 1. Copy Python core modules
for f in main.py menu_bar.py commander.py listener.py notifier.py db.py profile_manager.py dashboard_server.py ai_applier.py; do
    if [ -f "$SCRIPT_DIR/job_agent/$f" ]; then
        cp "$SCRIPT_DIR/job_agent/$f" "$TARGET_DIR/"
    fi
done

# 2. Copy scrapers
cp -r "$SCRIPT_DIR/job_agent/scrapers/"* "$TARGET_DIR/scrapers/"

# 3. Copy compiled web GUI
if [ -d "$SCRIPT_DIR/frontend/out" ]; then
    cp -r "$SCRIPT_DIR/frontend/out/"* "$TARGET_DIR/static/"
elif [ -d "$SCRIPT_DIR/job_agent/static" ]; then
    cp -r "$SCRIPT_DIR/job_agent/static/"* "$TARGET_DIR/static/"
fi

# 4. Copy Chrome extension
cp -r "$SCRIPT_DIR/extension/"* /usr/local/share/jobagent/extension/

echo "Safely synced code and GUI to /usr/local/share/jobagent without touching database or user configurations."
