#!/bin/bash
# =============================================================================
# ShieldNet Nosana Deployment Script
# =============================================================================
# Builds the ShieldNet ElizaOS agent Docker image, pushes it to GHCR,
# posts a Nosana GPU job, waits for the node URL, and validates liveness.
#
# Usage:
#   ./deploy.sh                          # default GPU market, 30min timeout
#   ./deploy.sh gpu                      # explicit GPU market
#   ./deploy.sh gpu 60                   # GPU market, 60min timeout
#   ./deploy.sh gpu 30 --dry-run         # print commands without executing
#
# Requirements:
#   - Docker running locally
#   - GitHub Container Registry access (GHCR_TOKEN set)
#   - nosana CLI installed: npm install -g @nosana/cli
#   - Nosana wallet funded with NOS tokens
# =============================================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

MARKET="${1:-gpu}"
TIMEOUT_MIN="${2:-30}"
DRY_RUN="${3:-}"

IMAGE_REPO="ghcr.io/hhhashexe/shieldnet-agent"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
IMAGE_FULL="${IMAGE_REPO}:${IMAGE_TAG}"
IMAGE_LATEST="${IMAGE_REPO}:latest"

JOB_DEF="nos_job_def/shieldnet.json"
HEALTH_PATH="/"
HEALTH_RETRIES=12
HEALTH_INTERVAL=10  # seconds between retries

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${BLUE}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
fail() { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
run()  { if [[ -n "$DRY_RUN" ]]; then echo -e "${YELLOW}[dry-run]${NC} $*"; else eval "$@"; fi; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           ShieldNet Nosana Deployment                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
log "Image:   ${IMAGE_FULL}"
log "Market:  ${MARKET}"
log "Timeout: ${TIMEOUT_MIN} minutes"
[[ -n "$DRY_RUN" ]] && warn "DRY RUN mode — no real commands will execute"
echo ""

# ─── Step 1: Preflight checks ─────────────────────────────────────────────────

log "Step 1: Preflight checks..."

# Verify Docker daemon is running
if ! docker info >/dev/null 2>&1; then
  fail "Docker is not running. Start Docker and retry."
fi
ok "Docker daemon is running"

# Verify nosana CLI is installed
if ! command -v nosana >/dev/null 2>&1; then
  fail "nosana CLI not found. Install with: npm install -g @nosana/cli"
fi
NOSANA_VERSION=$(nosana --version 2>/dev/null || echo "unknown")
ok "nosana CLI found (${NOSANA_VERSION})"

# Verify job definition exists
if [[ ! -f "$JOB_DEF" ]]; then
  fail "Job definition not found: ${JOB_DEF}"
fi
ok "Job definition found: ${JOB_DEF}"

# Check GHCR_TOKEN for pushing (warn only — may already be logged in)
if [[ -z "${GHCR_TOKEN:-}" ]]; then
  warn "GHCR_TOKEN not set — assuming docker is already authenticated to ghcr.io"
else
  log "Authenticating to ghcr.io..."
  run "echo \"\$GHCR_TOKEN\" | docker login ghcr.io -u hhhashexe --password-stdin"
  ok "Authenticated to ghcr.io"
fi

echo ""

# ─── Step 2: Build Docker image ───────────────────────────────────────────────

log "Step 2: Building Docker image..."
log "  → ${IMAGE_FULL}"

run "docker build \
  --label 'org.opencontainers.image.revision=${IMAGE_TAG}' \
  --label 'org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)' \
  --label 'org.opencontainers.image.title=ShieldNet ElizaOS Agent' \
  -t '${IMAGE_FULL}' \
  -t '${IMAGE_LATEST}' \
  ."

ok "Image built: ${IMAGE_FULL}"
echo ""

# ─── Step 3: Push to GitHub Container Registry ────────────────────────────────

log "Step 3: Pushing to ghcr.io..."
log "  Nosana nodes pull from GHCR — this is where they fetch the image."
log "  → Pushing ${IMAGE_FULL}"

run "docker push '${IMAGE_FULL}'"

log "  → Pushing ${IMAGE_LATEST}"
run "docker push '${IMAGE_LATEST}'"

ok "Image pushed to GHCR"
echo ""

# ─── Step 4: Post Nosana job ──────────────────────────────────────────────────

log "Step 4: Posting job to Nosana ${MARKET} market..."
log "  The Nosana scheduler will find a GPU node matching the job spec,"
log "  pull the image, and spin up the container."
log "  Job definition: ${JOB_DEF}"

# Capture the job ID from nosana output
JOB_OUTPUT=""
if [[ -z "$DRY_RUN" ]]; then
  JOB_OUTPUT=$(nosana job post \
    --file "${JOB_DEF}" \
    --market "${MARKET}" \
    --timeout "${TIMEOUT_MIN}" \
    2>&1) || fail "Failed to post Nosana job:\n${JOB_OUTPUT}"
  echo "$JOB_OUTPUT"
  JOB_ID=$(echo "$JOB_OUTPUT" | grep -oE '[A-Za-z0-9]{40,}' | head -1 || echo "unknown")
  ok "Job posted — ID: ${JOB_ID}"
else
  run "nosana job post --file '${JOB_DEF}' --market '${MARKET}' --timeout '${TIMEOUT_MIN}'"
  JOB_ID="dry-run-placeholder"
  ok "Job would be posted (dry run)"
fi
echo ""

# ─── Step 5: Wait for node URL ────────────────────────────────────────────────

log "Step 5: Waiting for node URL to become available..."
log "  Nosana assigns a public URL once the container is healthy."
log "  This may take 1–3 minutes while the node pulls the image."

NODE_URL=""
if [[ -z "$DRY_RUN" && "$JOB_ID" != "unknown" ]]; then
  for i in $(seq 1 20); do
    sleep 15
    log "  Checking job status (attempt ${i}/20)..."
    STATUS_OUTPUT=$(nosana job get "${JOB_ID}" 2>/dev/null || echo "")
    NODE_URL=$(echo "$STATUS_OUTPUT" | grep -oE 'https://[a-z0-9.-]+\.nos\.ci[^ ]*' | head -1 || true)
    if [[ -n "$NODE_URL" ]]; then
      ok "Node URL assigned: ${NODE_URL}"
      break
    fi
    echo "  → Not ready yet, waiting..."
  done

  if [[ -z "$NODE_URL" ]]; then
    warn "Node URL not detected after wait. Check manually:"
    warn "  nosana job get ${JOB_ID}"
    warn "  nosana job logs ${JOB_ID}"
    NODE_URL="https://unknown.node.k8s.prd.nos.ci"
  fi
else
  NODE_URL="https://shieldnet.node.k8s.prd.nos.ci"
  ok "Node URL (dry run): ${NODE_URL}"
fi
echo ""

# ─── Step 6: Health check ────────────────────────────────────────────────────

log "Step 6: Validating deployment health..."
log "  Probing ${NODE_URL}${HEALTH_PATH}"
log "  (${HEALTH_RETRIES} retries × ${HEALTH_INTERVAL}s = max $((HEALTH_RETRIES * HEALTH_INTERVAL))s)"

HEALTHY=false
if [[ -z "$DRY_RUN" ]]; then
  for i in $(seq 1 $HEALTH_RETRIES); do
    sleep $HEALTH_INTERVAL
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      --max-time 10 \
      "${NODE_URL}${HEALTH_PATH}" 2>/dev/null || echo "000")
    
    if [[ "$HTTP_CODE" =~ ^[23] ]]; then
      ok "Health check passed (HTTP ${HTTP_CODE}) — attempt ${i}/${HEALTH_RETRIES}"
      HEALTHY=true
      break
    fi
    warn "Attempt ${i}/${HEALTH_RETRIES}: HTTP ${HTTP_CODE} — retrying in ${HEALTH_INTERVAL}s..."
  done
else
  ok "Health check skipped (dry run)"
  HEALTHY=true
fi

echo ""

# ─── Deployment Summary ───────────────────────────────────────────────────────

echo "╔══════════════════════════════════════════════════════════╗"
echo "║                 Deployment Summary                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
log "Image:      ${IMAGE_FULL}"
log "Job ID:     ${JOB_ID}"
log "Node URL:   ${NODE_URL}"
log "Market:     ${MARKET}"

if $HEALTHY; then
  ok "Deployment SUCCESSFUL"
  echo ""
  echo "  Chat with ShieldNet:  ${NODE_URL}"
  echo "  Monitor job:          nosana job get ${JOB_ID}"
  echo "  View logs:            nosana job logs ${JOB_ID}"
  echo ""
else
  warn "Agent posted but health check did not pass within timeout."
  warn "The container may still be starting. Try:"
  warn "  curl ${NODE_URL}"
  warn "  nosana job logs ${JOB_ID}"
  exit 1
fi
