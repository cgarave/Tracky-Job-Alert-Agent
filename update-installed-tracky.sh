#!/bin/bash
# Update the installed Tracky code without touching the user's data or settings.
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR=/usr/local/share/jobagent
AGENT_DIR="$INSTALL_DIR/job_agent"

if [[ ! -d "$AGENT_DIR" || ! -f "$AGENT_DIR/main.py" ]]; then
  echo "Tracky is not installed at $INSTALL_DIR" >&2
  exit 1
fi
if [[ ! -f "$SOURCE_DIR/job_agent/cv_match.py" || ! -f "$SOURCE_DIR/job_agent/static/index.html" ]]; then
  echo "Tracky source or built dashboard assets are missing" >&2
  exit 1
fi

for file in "$SOURCE_DIR"/job_agent/*.py; do
  /usr/bin/install -m 644 "$file" "$AGENT_DIR/$(basename "$file")"
done
for file in "$SOURCE_DIR"/job_agent/scrapers/*.py; do
  /usr/bin/install -m 644 "$file" "$AGENT_DIR/scrapers/$(basename "$file")"
done
/usr/bin/rsync -a --delete "$SOURCE_DIR/job_agent/static/" "$AGENT_DIR/static/"
/usr/bin/install -m 644 "$SOURCE_DIR/requirements.txt" "$INSTALL_DIR/requirements.txt"

echo "Installed Tracky code and dashboard assets. User data and settings were preserved."
