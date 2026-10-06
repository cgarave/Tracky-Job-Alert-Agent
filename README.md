# Tracky (PH Job Alert Agent)

<p align="center">
  <img src="logos/Tracky.png" alt="Tracky Logo" width="160" style="border-radius: 20%;" />
</p>

A personal macOS daemon that monitors Philippine job boards and sends you Apple iMessage alerts on your iPhone whenever new listings match your keywords — controlled entirely by texting commands to yourself, using the macOS menu bar app, or through the sleek local web dashboard.

Track implementation progress in the [UX and Performance Implementation Plan](IMPLEMENTATION_PLAN.md).

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)
![Python](https://img.shields.io/badge/python-3.11%E2%80%933.14-blue?logo=python)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2016-black?logo=next.js)
![TailwindCSS](https://img.shields.io/badge/styling-Tailwind%20CSS-38bdf8?logo=tailwindcss)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- Minimal Enterprise Web Dashboard — Dark-mode control center at `http://127.0.0.1:5050` built with Next.js 16, Tailwind CSS, and Lucide icons for real-time job discovery and search management. Features incremental status polling, server-side pagination, and comprehensive server-backed filters.
- Smart Job Matching — Upload your CV for explainable fit scoring, best-fit job sorting, and optional Gemini-powered CV analysis.
- Advanced Job Management — Save jobs, mark as applied, recover dismissed jobs, and navigate efficiently using keyboard shortcuts.
- Scrapes 4 Major Job Boards — Automatically aggregates listings from Indeed.ph, JobStreet.ph, OnlineJobs.ph, and LinkedIn Jobs. Scrapers run concurrently for improved performance.
- iMessage Alerts to your iPhone — Instant, clean notifications with direct links to newly discovered job listings, backed by a persistent delivery retry queue with backoff.
- Two-Way iMessage Bot — Control search keywords, change check frequency, trigger scans, and check live stats directly via text. Commands are restricted to authorized configured recipients.
- macOS Menu Bar App — Live status indicator with custom icon, keyword manager, interval settings, and quick scan triggers.
- Fast & Lightweight Architecture — Pure SQLite deduplication with zero unnecessary browser automation overhead.
- Always-On Daemon — macOS `launchd` keeps the background scanner and local web server running seamlessly across reboots.

---

## Web GUI Control Center

Open `http://127.0.0.1:5050` in your browser or click "Open Dashboard..." from the macOS menu bar:

- Jobs Discovery Feed:
  - Search in real-time across titles, roles, and company names.
  - Filter by platform source (Indeed, JobStreet, OnlineJobs, LinkedIn), alert state, saved status, and application status.
  - Toggle between High-Density Enterprise Table and Visual Card Grid.
  - Manage jobs with save and mark-applied actions, or dismiss and recover them as needed.
  - Direct 1-click View Job button to open the listing in your default browser.
- Search & Alert Configuration:
  - Add, edit, or remove search keywords.
  - Set search location (e.g. `Philippines`, `Remote`, `Metro Manila`).
  - Configure background check interval in minutes.
  - Set your iMessage recipient phone number or Apple ID email.
  - Toggle background scanner daemon state (Active / Paused).
- Stats Ribbon:
  - Displays Total Tracked Listings, Discovered Today, Monitored Keywords, and Last Scan Timestamp, including per-source health and duration.
- Notification Delivery History:
  - Dedicated screen to review the delivery state and history of job alerts.

---

## iMessage Command Interface

Text any of these commands to your own phone number or Apple ID from your iPhone:

| Command | Description |
|---|---|
| `/help` | Show all available commands |
| `/status` | View current settings, scan state, and tracking statistics |
| `/keywords` | List all active search keywords |
| `/add <keyword>` | Add a new search keyword (e.g. `/add react native developer`) |
| `/remove <keyword>` | Remove an existing keyword (e.g. `/remove web developer`) |
| `/interval <minutes>` | Change check frequency (e.g. `/interval 30`) |
| `/location <place>` | Change location filter (e.g. `/location Remote`) |
| `/run` | Trigger an immediate job scan |
| `/pause` \| `/resume` | Pause or resume the background scraper |
| `/dashboard` | Receive a direct link to your local web dashboard |

### Example Alert on Your iPhone

```text
New Job Alert!

Senior Full Stack Developer
Cloud Solutions PH
Indeed.ph
https://ph.indeed.com/viewjob?jk=abc12345
```

---

## Requirements

- macOS 12 Monterey or later
- Standard CPython 3.11 or newer (3.11 through 3.14 are tested; newer releases are checked during setup).
- Node.js 18+ *(only if modifying and rebuilding frontend)*
- Messages.app signed in to iMessage
- Full Disk Access granted to Python (to read `chat.db` for incoming commands)

---

## Installation & Setup

### Option A — macOS Setup App Installer (Recommended)

A native SwiftUI setup app shell provides step-by-step navigation and runtime checks to install Tracky seamlessly on macOS 12+ (built as a universal arm64 and x86_64 binary).
The installer detects the newest compatible CPython runtime and isolates Tracky dependencies in a virtual environment.

```bash
git clone https://github.com/cgarave/ph-job-alert-agent.git
cd ph-job-alert-agent
bash install.sh
```

The installer will ask for your phone number / Apple ID, install dependencies, compile the dashboard frontend, and register the background `launchd` daemons.

### Option B — Run Locally in Development

```bash
# 1. Install Python dependencies
pip3 install -r requirements.txt
playwright install chromium

# 2. Build the frontend (exports to job_agent/static/)
cd frontend && npm install && npm run build:static && cd ..

# 3. Start the dashboard server and daemon
python3 job_agent/main.py
```

### Required: Grant Full Disk Access to Python

The command listener reads `~/Library/Messages/chat.db` to detect your incoming `/commands`.

1. Open System Settings -> Privacy & Security -> Full Disk Access
2. Click +, then press Cmd + Shift + G in the file picker
3. Paste the directory containing your selected Python binary, such as `/Library/Frameworks/Python.framework/Versions/3.14/bin` *(the setup app detects the installed version)*
4. Select `python3` -> click Open -> toggle ON

---

## Default Keywords

Tracky starts with these default search terms (all editable via `/add`, `/remove`, or the web GUI):

- `software engineer`
- `frontend engineer`
- `web developer`
- `ai engineer`
- `full stack developer`
- `react developer`

Default Location: Philippines · Default Check Interval: 60 minutes

---

## Project Structure

```
tracky/
├── Tracky.app               # macOS launcher applet with custom icon
├── Start Tracky.command     # Double-clickable shell launcher
├── logos/                   # App icon & branding assets (ICNS, PNG, JPG)
├── frontend/                # Next.js 16 Web GUI
│   ├── src/
│   │   ├── app/             # App Router & page layout
│   │   ├── components/      # Sidebar, Stats Ribbon, Jobs & Settings tabs
│   │   ├── lib/             # API client & utilities
│   │   └── types/           # TypeScript interfaces
│   └── package.json
├── job_agent/               # Python Backend & Daemon
│   ├── main.py              # Daemon entry point (scraper + listener threads)
│   ├── dashboard_server.py  # Zero-dependency local REST API & static file server
│   ├── menu_bar.py          # macOS menu bar app
│   ├── config.json          # User settings (keywords, interval, recipient)
│   ├── commander.py         # Parses and executes iMessage commands
│   ├── listener.py          # Polls chat.db for incoming commands
│   ├── notifier.py          # Sends iMessages via AppleScript
│   ├── db.py                # SQLite job deduplication & analytics
│   ├── static/              # Compiled static Next.js export assets
│   └── scrapers/
│       ├── indeed.py        # Indeed.ph via python-jobspy
│       ├── jobstreet.py     # JobStreet.ph via Playwright
│       ├── onlinejobs.py    # OnlineJobs.ph via requests + BeautifulSoup4
│       └── linkedin.py      # LinkedIn Jobs via python-jobspy
├── scripts/
│   └── agent-verify.sh      # Cross-agent validation & build check suite
├── requirements.txt         # Python dependencies
├── install.sh               # One-step installation script
└── README.md                # Project documentation
```

---

## Managing the Daemon

```bash
# Check if the daemon is running
launchctl list | grep jobagent

# View live daemon logs
tail -f ~/Library/Logs/jobagent.log

# Restart the daemon
launchctl unload ~/Library/LaunchAgents/com.jobagent.plist \
  && launchctl load ~/Library/LaunchAgents/com.jobagent.plist

# Stop the daemon
launchctl unload ~/Library/LaunchAgents/com.jobagent.plist

# Perform a dry run (scrapes and prints results to terminal, no messages sent)
python3 job_agent/main.py --dry-run
```

---

## Tech Stack

| Component | Tool |
|---|---|
| Dashboard UI | [Next.js 16](https://nextjs.org/) + [React 19](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/) |
| Icons & UI Primitives | [Lucide React](https://lucide.dev/) + [Radix UI](https://www.radix-ui.com/) |
| Local API Server | Python 3.11–3.14 `http.server` (Zero extra backend dependencies) |
| Menu Bar App | [rumps](https://github.com/jaredks/rumps) (macOS PyObjC wrapper) |
| Indeed & LinkedIn Scraper | [`python-jobspy`](https://github.com/Bunsly/JobSpy) |
| JobStreet Scraper | [Playwright Chromium](https://playwright.dev/python/) |
| OnlineJobs.ph Scraper | [requests](https://requests.readthedocs.io) + [BeautifulSoup4](https://www.crummy.com/software/BeautifulSoup/) |
| Job Deduplication & DB | SQLite3 (`seen_jobs.db`) |
| iMessage Notifications | AppleScript via macOS `osascript` |
| iMessage Command Listener| `~/Library/Messages/chat.db` (SQLite read) |
| Process Daemon | macOS `launchd` LaunchAgent (`com.jobagent.plist`) |

---

## License

MIT — feel free to fork, customize, and share.
