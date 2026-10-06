#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/usr/local/share/jobagent"
CURRENT_USER="$(stat -f '%Su' /dev/console)"
CURRENT_USER_HOME="$(sudo -u "$CURRENT_USER" sh -c 'echo $HOME')"
RUNTIME_TOOL="$INSTALL_DIR/job_agent/python_runtime.py"
PYTHON=""
for probe in /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3; do
    if [ -x "$probe" ]; then
        PYTHON=$(sudo -u "$CURRENT_USER" "$probe" "$RUNTIME_TOOL" --path 2>/dev/null || echo "")
        [ -n "$PYTHON" ] && break
    fi
done
if [ -z "$PYTHON" ]; then
    echo "No supported CPython 3.11+ runtime was found." >&2
    exit 2
fi

VENV_DIR="$CURRENT_USER_HOME/Library/Application Support/Tracky/venv"
VENV_PYTHON="$VENV_DIR/bin/python"
mkdir -p "$VENV_DIR"
chown -R "$CURRENT_USER" "$CURRENT_USER_HOME/Library/Application Support/Tracky"
if [ ! -x "$VENV_PYTHON" ]; then
    sudo -u "$CURRENT_USER" "$PYTHON" -m venv "$VENV_DIR"
fi

echo "Installing Tracky dependencies with Python $($VENV_PYTHON --version 2>&1)"
sudo -u "$CURRENT_USER" "$VENV_PYTHON" -m pip install --upgrade pip --disable-pip-version-check --quiet
sudo -u "$CURRENT_USER" "$VENV_PYTHON" -m pip install -r "$INSTALL_DIR/requirements.txt" --disable-pip-version-check --quiet
echo "Installing Playwright Chromium"
sudo -u "$CURRENT_USER" "$VENV_PYTHON" -m playwright install chromium

sudo -u "$CURRENT_USER" launchctl kickstart -k "gui/$(id -u "$CURRENT_USER")/com.jobagent" 2>/dev/null || true
sudo -u "$CURRENT_USER" launchctl kickstart -k "gui/$(id -u "$CURRENT_USER")/com.jobagent.menubar" 2>/dev/null || true
echo "Tracky runtime is ready"
