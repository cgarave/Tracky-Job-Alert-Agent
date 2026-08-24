# 🐶 Tracky — Setup Guide

> Personal macOS job alert daemon sending iMessage notifications to your iPhone.

---

## Installation

There are two ways to install. Choose whichever suits you.

---

### Option A — pkg Installer *(recommended)*

No Terminal required. Works for sharing with friends too.

1. Download **`JobAlertAgent.pkg`** from the [Releases](../../releases) page
2. Double-click it — the standard macOS installer opens
3. Click through **Introduction → Installation**
4. A dialog appears asking for your **phone number or Apple ID** — enter the one registered in your Messages.app (e.g. `+639171234567` or `you@icloud.com`)
5. Click **Set Up** — the installer handles everything silently
6. A completion alert reminds you about the Full Disk Access step (see below)
7. Check your iPhone — you should receive a welcome iMessage shortly

---

### Option B — Terminal Installer

If you cloned the repo and prefer the command line:

```bash
bash install.sh
```

This does the same thing as the pkg — installs dependencies, asks for your phone number, and starts the daemon.

---

## Required: Grant Full Disk Access to Python

The command listener reads `~/Library/Messages/chat.db` to detect your `/commands` from iPhone. macOS requires Full Disk Access for this — **both installation methods need this one-time step**.

1. Open **System Settings → Privacy & Security → Full Disk Access**
2. Click the **+** button
3. In the file picker, press **⌘ Cmd + Shift + G**
4. Paste this path and press Enter:
   ```
   /Library/Frameworks/Python.framework/Versions/3.11/bin
   ```
5. Select **`python3`** → click **Open** → toggle **ON**
6. Restart the daemon (or reboot) for the change to take effect

> **Why Python, not Terminal?** The daemon runs as an independent `python3` process launched by macOS `launchd` — it has no connection to Terminal and needs its own permission grant.

---

## Verify It's Working

Check your iPhone for the welcome iMessage, then test from your iPhone:

| You text | Agent replies |
|----------|---------------|
| `/help` | Command list |
| `/status` | Current settings |
| `/run` | Triggers an immediate job scan |

Check the logs on your Mac anytime:
```bash
tail -f ~/Library/Logs/jobagent.log
```

---

## Controlling the Agent from iPhone

Text commands to **your own phone number / Apple ID** in Messages. They appear in your own conversation thread on your iPhone.

### Full Command Reference

| Command | What it does |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Current settings, keywords, last run info |
| `/keywords` | List your active search keywords |
| `/add <term>` | Add a job keyword (e.g. `/add python developer`) |
| `/remove <term>` | Remove a keyword (e.g. `/remove react developer`) |
| `/interval <min>` | Change check frequency (e.g. `/interval 30` for every 30 min) |
| `/location <place>` | Change location filter (e.g. `/location Remote`) |
| `/run` | Trigger an immediate job scan right now |
| `/pause` | Stop scanning (bot stays alive for commands) |
| `/resume` | Resume scanning after a pause |

---

## Job Alert Format

Each new job gets its own iMessage:

```
🆕 New Job Alert!

📋 Senior Frontend Engineer
🏢 Accenture Philippines
🌐 Indeed.ph
🔗 https://ph.indeed.com/viewjob?jk=abc123
```

Up to 30 individual messages are sent per scan. If more than 30 new jobs are found in one run, a note is added suggesting you narrow your keywords.

---

## Managing the Daemon

```bash
# Check the daemon is registered and running (should show a PID)
launchctl list | grep jobagent

# View live logs
tail -f ~/Library/Logs/jobagent.log

# Restart the daemon (e.g. after a code update)
launchctl unload ~/Library/LaunchAgents/com.jobagent.plist \
  && launchctl load ~/Library/LaunchAgents/com.jobagent.plist

# Stop the daemon completely
launchctl unload ~/Library/LaunchAgents/com.jobagent.plist

# Start it again
launchctl load ~/Library/LaunchAgents/com.jobagent.plist

# Dry run — scrapes and prints results, no messages sent
python3 /usr/local/share/jobagent/job_agent/main.py --dry-run
```

---

## Troubleshooting

### Commands not working / no reply to `/help`

1. Check the logs for the exact error:
   ```bash
   tail -50 ~/Library/Logs/jobagent.log
   ```
2. If you see **"Full Disk Access not granted"** — follow the Full Disk Access step above. Make sure you added **`python3`** (not Terminal).
3. Make sure you're texting **your own number / Apple ID** — the same one you entered during setup.
4. Verify the daemon is running: `launchctl list | grep jobagent`

### iMessages not sending

- Make sure **Messages.app is open** on your Mac
- Make sure your Mac is **signed in to iMessage** (Messages → Settings → iMessage)
- Test manually in Terminal:
  ```bash
  osascript -e 'tell application "Messages" to send "test" to participant "+639XXXXXXXXX" of 1st account whose service type = iMessage'
  ```

### "No new jobs" on every run

The agent tracks all previously seen jobs to avoid duplicates. On first run it marks everything as seen. Text `/run` — if it finds jobs the second time, deduplication is working correctly.

### JobStreet.ph returns 0 results

JobStreet uses heavy JavaScript rendering. Re-install Playwright:
```bash
python3 -m playwright install chromium
```

### Daemon not auto-starting after reboot

```bash
launchctl load ~/Library/LaunchAgents/com.jobagent.plist
```

---

## Building the pkg (for contributors)

After making changes to the agent code, rebuild the installer:

```bash
bash build-pkg.sh
```

Output: `dist/JobAlertAgent.pkg` — attach this to a GitHub Release so others can download it.

---

## File Structure

```
ph-job-alert-agent/
├── job_agent/
│   ├── main.py          ← Daemon entry point
│   ├── config.json      ← Your settings (edited by the bot, not manually)
│   ├── seen_jobs.db     ← SQLite job history (auto-created)
│   ├── commander.py     ← Command parser
│   ├── listener.py      ← chat.db poller (reads incoming iMessages)
│   ├── notifier.py      ← iMessage sender via AppleScript
│   ├── db.py            ← Deduplication logic
│   └── scrapers/
│       ├── indeed.py
│       ├── jobstreet.py
│       └── onlinejobs.py
├── pkg-build/
│   ├── scripts/
│   │   ├── preinstall   ← Python version check
│   │   └── postinstall  ← Deps, dialog, config, launchd setup
│   ├── resources/
│   │   └── welcome.html ← Installer welcome screen
│   └── Distribution.xml ← Installer UI config
├── requirements.txt
├── build-pkg.sh         ← Run this to produce JobAlertAgent.pkg
├── install.sh           ← Terminal-based alternative to pkg
└── SETUP.md             ← This file
```
