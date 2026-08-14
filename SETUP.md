# Job Agent — Setup Guide

> Text commands to your own number from your iPhone to control the agent.

---

## Quick Start

```bash
cd /Users/ravforejinoeflores/Documents/antigravity/joyful-bose
bash install.sh
```

That's it for the Mac side. But first, you need to complete **Step 1** below.

---

## Step 1 — Grant Full Disk Access to Terminal

The agent reads your Mac's local Messages database (`~/Library/Messages/chat.db`) to detect incoming commands. macOS requires **Full Disk Access** for this.

1. Open **System Settings** → **Privacy & Security** → **Full Disk Access**
2. Click the **+** button
3. Navigate to `/Applications/Utilities/Terminal.app` and add it
4. Toggle it **ON**

> **Do this before running `install.sh`**, otherwise the command listener won't work and you'll see an error in the logs.

---

## Step 2 — Run the Installer

Open Terminal, navigate to the project folder, and run:

```bash
bash install.sh
```

The installer will:
- Install all Python dependencies (`python-jobspy`, `playwright`, `beautifulsoup4`, etc.)
- Download the Playwright Chromium browser (used for JobStreet.ph)
- Ask for your phone number or Apple ID (e.g. `+639171234567` or `you@icloud.com`)
- Write `job_agent/config.json` with your settings and default keywords
- Create and load the macOS LaunchAgent (runs automatically at login)
- Send you a welcome iMessage on your iPhone: *"👋 Job Agent is online!"*

---

## Step 3 — Verify It's Working

Check your iPhone for the welcome message, then test from your iPhone:

| You text | Agent replies |
|----------|---------------|
| `/help` | Command list |
| `/status` | Current settings |
| `/run` | Immediate job scan |

Check the logs on your Mac anytime:
```bash
tail -f ~/Library/Logs/jobagent.log
```

---

## Controlling the Agent from iPhone

Just text commands to **your own phone number / Apple ID** in Messages. They'll appear in your own conversation thread on your iPhone.

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

When a new job is found, you'll receive an iMessage like this:

```
🆕 New Job Alert!

📋 Senior Frontend Engineer
🏢 Accenture Philippines
🌐 Indeed.ph
🔗 https://ph.indeed.com/viewjob?jk=abc123
```

If 6 or more new jobs are found in a single scan, you'll get a digest summary instead of individual messages (to avoid notification spam).

---

## Managing the Daemon

```bash
# Check the daemon is registered and running
launchctl list | grep jobagent

# View live logs
tail -f ~/Library/Logs/jobagent.log

# Stop the daemon
launchctl unload ~/Library/LaunchAgents/com.jobagent.plist

# Start it again
launchctl load ~/Library/LaunchAgents/com.jobagent.plist

# Dry run (scrapes + prints results, no messages sent)
python3 job_agent/main.py --dry-run
```

---

## Troubleshooting

### "No new jobs" every run
The agent tracks all previously seen jobs to avoid duplicates. On first run it may see many jobs and mark them all as seen. Text `/run` after the first run to get a fresh scan.

### Commands not being received
- Make sure you granted **Full Disk Access** to Terminal (Step 1)
- Make sure you're texting **your own number / Apple ID** — the same one in `config.json`
- Check the logs: `tail -50 ~/Library/Logs/jobagent.log`

### iMessages not sending
- Make sure **Messages.app is open** on your Mac
- Make sure your Mac is **logged in to iMessage** (Messages → Preferences → iMessage tab)
- Test manually: open Terminal and run:
  ```bash
  osascript -e 'tell application "Messages" to send "test" to participant "+639XXXXXXXXX" of 1st account whose service type = iMessage'
  ```

### JobStreet.ph returns no results
JobStreet uses heavy JavaScript rendering. If Playwright fails, check:
```bash
python3 -c "from playwright.sync_api import sync_playwright; print('OK')"
python3 -m playwright install chromium  # Re-run if needed
```

### Daemon not starting after reboot
```bash
launchctl list | grep jobagent
# If not listed, reload:
launchctl load ~/Library/LaunchAgents/com.jobagent.plist
```

---

## File Structure

```
joyful-bose/
├── job_agent/
│   ├── main.py          ← Daemon entry point
│   ├── config.json      ← Your settings (edited by the bot)
│   ├── seen_jobs.db     ← SQLite job history (auto-created)
│   ├── commander.py     ← Command parser
│   ├── listener.py      ← chat.db poller
│   ├── notifier.py      ← iMessage sender
│   ├── db.py            ← Deduplication logic
│   └── scrapers/
│       ├── indeed.py
│       ├── jobstreet.py
│       └── onlinejobs.py
├── requirements.txt
├── install.sh
└── SETUP.md             ← This file
```
