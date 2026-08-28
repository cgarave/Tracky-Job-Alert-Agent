#!/usr/bin/env bash
# =============================================================================
#  agent-verify.sh — Cross-Agent Quality & Build Verification Pipeline
#  Used by QA Reviewer, Tester, and Orchestrator to certify branches before merge.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

info()    { echo -e "${GREEN}✔${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✘${NC}  $*"; }
section() { echo -e "\n${GREEN}▸${NC}  $*"; }

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   🤖 Cross-Agent Quality & Build Validator       ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. Python Module Compilation Check ───────────────────────────────────────
section "1. Validating Python modules compilation..."
python3 -m py_compile \
    "$SCRIPT_DIR/job_agent/main.py" \
    "$SCRIPT_DIR/job_agent/dashboard_server.py" \
    "$SCRIPT_DIR/job_agent/db.py" \
    "$SCRIPT_DIR/job_agent/notifier.py" \
    "$SCRIPT_DIR/job_agent/profile_manager.py" \
    "$SCRIPT_DIR/job_agent/applier/engine.py" \
    "$SCRIPT_DIR/job_agent/applier/indeed_applier.py" \
    "$SCRIPT_DIR/job_agent/applier/jobstreet_applier.py" \
    "$SCRIPT_DIR/job_agent/applier/onlinejobs_applier.py" \
    "$SCRIPT_DIR/job_agent/applier/linkedin_applier.py" \
    "$SCRIPT_DIR/job_agent/applier/session_manager.py" \
    "$SCRIPT_DIR/job_agent/applier/browser_manager.py" \
    "$SCRIPT_DIR/job_agent/scrapers/indeed.py" \
    "$SCRIPT_DIR/job_agent/scrapers/jobstreet.py" \
    "$SCRIPT_DIR/job_agent/scrapers/onlinejobs.py" \
    "$SCRIPT_DIR/job_agent/scrapers/linkedin.py"

info "All Python backend and applier modules compiled with 0 syntax errors."

# ── 2. Next.js Frontend Build & Typecheck ────────────────────────────────────
section "2. Validating Next.js frontend build & TypeScript types..."
(cd "$SCRIPT_DIR/frontend" && npm run build)
info "Frontend compiled successfully (TypeScript and static pages verified)."

# ── 3. Rule Compliance Check ─────────────────────────────────────────────────
section "3. Checking Agent Governance files..."
if [ -f "$SCRIPT_DIR/agents/RULES.md" ]; then
    info "agents/RULES.md present."
else
    error "Missing agents/RULES.md!"
    exit 1
fi

echo ""
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║   ✅ ALL CROSS-AGENT CHECKS PASSED               ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo ""
