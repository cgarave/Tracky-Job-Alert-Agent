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
- 📦 **pkg installer** — share a double-click installer with friends, no Terminal needed

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

- **macOS 12 Monterey or later**
- **Python 3.11+**
- **Messages.app** signed in to iMessage
- **Full Disk Access** granted to Python (for reading `chat.db` — one-time setup)

---

## 🚀 Installation

### Option A — pkg Installer *(recommended, no Terminal needed)*

1. Download **`JobAlertAgent.pkg`** from the [Releases](../../releases) page
2. Double-click it and follow the installer steps
3. A dialog will appear asking for your phone number or Apple ID
4. After installation, grant Full Disk Access to Python *(see below)*

### Option B — Manual install from source

```bash
git clone https://github.com/yourusername/ph-job-alert-agent.git
cd ph-job-alert-agent
bash install.sh
```

The installer will ask for your phone number, install all dependencies, and start the daemon automatically.

### ⚠️ Required: Grant Full Disk Access to Python

The command listener reads `~/Library/Messages/chat.db` to detect your incoming `/commands`. Both installation methods require this one-time step:

1. Open **System Settings → Privacy & Security → Full Disk Access**
2. Click **+**, then press **⌘ Cmd + Shift + G** in the file picker
3. Paste: `/Library/Frameworks/Python.framework/Versions/3.11/bin`
4. Select **`python3`** → click **Open** → toggle **ON**

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
├── pkg-build/
│   ├── scripts/
│   │   ├── preinstall   # Checks Python version before install
│   │   └── postinstall  # Installs deps, shows setup dialog, loads daemon
│   ├── resources/
│   │   └── welcome.html # Installer welcome screen
│   └── Distribution.xml # Installer UI configuration
├── requirements.txt
├── build-pkg.sh         # Builds JobAlertAgent.pkg for distribution
├── install.sh           # Terminal-based setup (alternative to pkg)
└── SETUP.md             # Detailed setup guide and troubleshooting
```

---

## 📦 Building the pkg (for contributors)

To build a fresh `JobAlertAgent.pkg` for distribution after making changes:

```bash
bash build-pkg.sh
```

Output: `dist/JobAlertAgent.pkg` — ready to share or attach to a GitHub Release.

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

# Stop the daemon completely
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
| Installer | `pkgbuild` + `productbuild` |

---

## 📄 License

MIT — feel free to fork, modify, and share.
