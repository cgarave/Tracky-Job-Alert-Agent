# 🤖 PH Job Alert Agent

A personal macOS daemon that monitors Philippine job boards and sends you **Apple iMessage alerts on your iPhone** whenever new listings match your keywords — controlled entirely by texting commands to yourself.

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)
![Python](https://img.shields.io/badge/python-3.11%2B-blue?logo=python)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- 🔍 **Scrapes 3 Philippine job boards** — Indeed.ph, JobStreet.ph, OnlineJobs.ph
- 📱 **iMessage alerts to your iPhone** — no third-party apps needed
- 💬 **Two-way iMessage bot** — control everything by texting commands to yourself
- 🔁 **Runs in the background** — macOS `launchd` keeps it alive across reboots
- 🧠 **Smart deduplication** — SQLite database prevents duplicate notifications
- ⚙️ **Fully configurable** — change keywords, interval, and location via iMessage

---

## 📲 iMessage Command Interface

Once installed, just text these commands to **your own phone number / Apple ID** from your iPhone:

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/status` | Current settings, keywords, last run info |
| `/keywords` | List active search keywords |
| `/add <keyword>` | Add a keyword (e.g. `/add python developer`) |
| `/remove <keyword>` | Remove a keyword |
| `/interval <minutes>` | Change check frequency (e.g. `/interval 30`) |
| `/location <place>` | Change location filter (e.g. `/location Remote`) |
| `/run` | Trigger an immediate job scan |
| `/pause` | Pause the scraper |
| `/resume` | Resume the scraper |

### Example alert on your iPhone

```
🆕 New Job Alert!

📋 Senior Frontend Engineer
🏢 Accenture Philippines
🌐 Indeed.ph
🔗 https://ph.indeed.com/viewjob?jk=abc123
```

---

## 🛠 Requirements

- **macOS** (tested on macOS Ventura / Sonoma)
- **Python 3.11+**
- **Messages.app** signed in to iMessage
- **Full Disk Access** granted to your Python binary (for reading `chat.db`)

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/ph-job-alert-agent.git
cd ph-job-alert-agent
```

### 2. Grant Full Disk Access to Python

The command listener reads `~/Library/Messages/chat.db` to detect your incoming `/commands`. macOS requires explicit permission for this.

1. Open **System Settings → Privacy & Security → Full Disk Access**
2. Click **+**, then press **⌘ Cmd + Shift + G** in the file picker
3. Paste: `/Library/Frameworks/Python.framework/Versions/3.11/bin`
4. Select **`python3`** → click **Open** → toggle **ON**

### 3. Run the installer

```bash
bash install.sh
```

The installer will:
- Install all Python dependencies
- Download the Playwright Chromium browser (for JobStreet.ph)
- Ask for your phone number or Apple ID
- Write `job_agent/config.json` with default settings
- Register and start the background daemon via `launchd`
- Send a welcome iMessage to your iPhone

---

## ⚙️ Default Keywords

The agent ships with these search terms out of the box (all editable via `/add` and `/remove`):

- `software engineer`
- `frontend engineer`
- `web developer`
- `ai engineer`
- `full stack developer`
- `react developer`

Default location: **Philippines** · Default interval: **60 minutes**

---

## 📁 Project Structure

```
ph-job-alert-agent/
├── job_agent/
│   ├── main.py          # Daemon entry point — two-thread architecture
│   ├── config.json      # Your settings (managed by the bot)
│   ├── commander.py     # Parses and executes iMessage commands
│   ├── listener.py      # Polls chat.db for incoming commands
│   ├── notifier.py      # Sends iMessages via AppleScript
│   ├── db.py            # SQLite job deduplication
│   └── scrapers/
│       ├── indeed.py    # Indeed.ph via python-jobspy
│       ├── jobstreet.py # JobStreet.ph via Playwright
│       └── onlinejobs.py# OnlineJobs.ph via requests + BeautifulSoup
├── requirements.txt
├── install.sh           # One-command setup
├── SETUP.md             # Detailed setup guide and troubleshooting
└── com.jobagent.plist   # macOS launchd LaunchAgent config
```

---

## 🔧 Managing the Daemon

```bash
# Check the daemon is running (should show a PID)
launchctl list | grep jobagent

# View live logs
tail -f ~/Library/Logs/jobagent.log

# Restart the daemon
launchctl unload ~/Library/LaunchAgents/com.jobagent.plist \
  && launchctl load ~/Library/LaunchAgents/com.jobagent.plist

# Stop the daemon
launchctl unload ~/Library/LaunchAgents/com.jobagent.plist

# Dry run (scrapes and prints results, no messages sent)
python3 job_agent/main.py --dry-run
```

---

## ⚠️ Limitations

- **macOS only** — iMessage, AppleScript, and `launchd` are Apple-specific
- **Mac must be awake** — the agent pauses when your Mac sleeps and resumes on wake
- **Personal use only** — web scraping is for personal, non-commercial use; see each site's Terms of Service
- OnlineJobs.ph scrapes **public listings only** (login-gated content not included)

---

## 🧰 Tech Stack

| Component | Tool |
|-----------|------|
| Indeed.ph | [`python-jobspy`](https://github.com/Bunsly/JobSpy) |
| JobStreet.ph | [Playwright](https://playwright.dev/python/) |
| OnlineJobs.ph | [requests](https://requests.readthedocs.io) + [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) |
| Notifications | AppleScript via `osascript` |
| Command input | `~/Library/Messages/chat.db` polling |
| Deduplication | SQLite (`sqlite3` stdlib) |
| Scheduling | macOS `launchd` LaunchAgent |

---

## 📄 License

MIT — feel free to fork, modify, and share.
