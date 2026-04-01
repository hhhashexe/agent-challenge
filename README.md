# ShieldNet

**AI-powered web security scanner with 26 attack vectors and a real CVE track record.**

> Nosana x ElizaOS Agent Challenge — built by [Hash Security](https://scan.bughunt.tech)

[![ElizaOS v2](https://img.shields.io/badge/ElizaOS-v2-blue)](https://github.com/elizaos/eliza)
[![Nosana](https://img.shields.io/badge/Powered%20by-Nosana-purple)](https://nosana.io)
[![Model](https://img.shields.io/badge/Model-Qwen3.5--27B-orange)](https://huggingface.co/Qwen)
[![Actions](https://img.shields.io/badge/Actions-9-brightgreen)](https://github.com/hhhashexe/agent-challenge)
[![CVEs](https://img.shields.io/badge/CVEs%20Discovered-3-red)](https://scan.bughunt.tech)

ShieldNet is an ElizaOS agent that scans websites, reviews code, generates red team attack narratives, and produces graded security reports — all running on Nosana's decentralized GPU infrastructure.

CVEs discovered: GHSA-j73w (Critical 9.1), GHSA-cqrc (High 7.1), GHSA-c9jw (High 7.5).

---

## Quick Example

```
You:        scan https://example.com

ShieldNet:  Scanning https://example.com. Checking headers, SSL chain,
            XSS/SQLi/SSRF vectors, CORS policy, open ports, DNS.
            Results in 30-60 seconds.

            Scan complete — https://example.com
            Grade D (41/100): missing CSP header (XSS risk), missing HSTS
            (downgrade attack risk), CORS misconfiguration.

            [CRITICAL] — 1 finding
              • Missing Content-Security-Policy
                No CSP header detected. Reflected or stored XSS on any
                endpoint can execute arbitrary JavaScript in users' browsers.
                Fix: Add Content-Security-Policy: default-src 'self'; this
                blocks inline scripts and restricts resource origins.

            [HIGH] — 2 findings
              • Missing HSTS
                Without Strict-Transport-Security, browsers may accept HTTP
                connections. Attackers on the same network can downgrade HTTPS
                to HTTP and intercept traffic.
                Fix: Add Strict-Transport-Security: max-age=31536000;
                includeSubDomains

              • CORS wildcard
                Access-Control-Allow-Origin: * allows any domain to read API
                responses from a browser context.
                Fix: Whitelist specific origins.

            [MEDIUM] — 3 findings
            ...

            Address [CRITICAL] and [HIGH] findings first.
            Run "security report" for executive summary.
            Run "red team report" to see attack chains.
```

---

## Actions

| Action | Trigger | What it does |
|--------|---------|-------------|
| `SCAN_URL` | `scan https://target.com` | Full vuln scan — XSS, SQLi, SSRF, CORS, headers, SSL, ports, DNS |
| `ANALYZE_CODE` | Paste code + "review" | OWASP Top 10 code review with fix examples |
| `RED_TEAM` | `red team report` | Realistic attack chains chained from scan findings |
| `SECURITY_REPORT` | `security report` | Executive summary with A-F grade and business impact |
| `SCAN_HISTORY` | `show scan history` | All scans this session with grades and timestamps |
| `COMPARE_SITES` | `compare site1.com vs site2.com` | Side-by-side security comparison |
| `SCAN_GITHUB` | `scan github.com/user/repo` | Repo audit — secrets, dangerous deps, misconfigs |
| `EXPORT_REPORT` | `export report` | Full markdown report for sharing |
| `SELF_SCAN` | `scan yourself` | Agent scans its own infrastructure |
| `AGGRESSIVE_SCAN` 🔴 | `aggressive scan https://target.com` | Scan + LLM-generated exploit payloads per finding |
| `GENERATE_PAYLOAD` 🔴 | `generate payload for XSS` | Standalone payload generator with WAF bypass variants |
| `ATTACK_CHAIN` 🔴 | `attack chain for https://target.com` | Full exploit chain with concrete commands |

---

## 🔴 Aggressive Mode

ShieldNet's **Aggressive Mode** combines standard vulnerability scanning with an uncensored LLM to generate concrete, actionable exploit payloads for each finding.

### What it does

**`aggressive scan <url>`** — 3-phase offensive assessment:
1. **Reconnaissance** — standard ShieldNet scan across 26 attack vectors
2. **Payload generation** — for each critical/high/medium finding, the LLM generates:
   - Proof-of-concept payload
   - WAF bypass variant
   - Chained attack using this + other common vulns
3. **Report** — combined output with grades, findings, and generated payloads

**`generate payload for <vuln-type>`** — standalone payload generator:
- Basic PoC payload
- Stealth/encoded variant
- WAF bypass (Cloudflare, ModSecurity, AWS WAF)
- Impact maximizer
- Automation one-liner (curl/Python/Bash)

**`attack chain for <url>`** — full exploit chain with actual commands:
- Phase 1: Reconnaissance commands (curl, nmap, whatweb)
- Phase 2: Initial foothold with raw HTTP requests
- Phase 3: Escalation steps with exact commands
- Phase 4: Persistence / data exfiltration commands
- Phase 5: Covering tracks
- Quick-win one-liners for each high-severity finding

### Requirements

- **GPU required** — Aggressive Mode uses a large uncensored LLM (WhiteRabbitNeo-13B)
- **Nosana deployment** — use `nos_job_def/shieldnet-aggressive.json` to run on Nosana GPU network
- **Local GPU** — set `OPENAI_API_URL` to your local vLLM endpoint

### Nosana Deployment (Aggressive Mode)

```bash
# Deploy with WhiteRabbitNeo-13B on Nosana GPU
nosana job post --file nos_job_def/shieldnet-aggressive.json --market nvidia-3090
```

The job definition at `nos_job_def/shieldnet-aggressive.json` runs:
- **Op 1**: `vllm/vllm-openai` serving `WhiteRabbitNeo/WhiteRabbitNeo-13B` on port 8000 (GPU)
- **Op 2**: ShieldNet agent connected to the local vLLM endpoint

### ⚠️ Authorized Testing Only

Aggressive Mode is designed for **authorized penetration testing** of systems you own or have written permission to test. Generated payloads are for security validation, not malicious use. Always confirm scope and authorization before running aggressive scans.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      ElizaOS v2                         │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │              ShieldNet Plugin                     │  │
│  │                                                   │  │
│  │  ┌────────────┐    ┌───────────────────────┐      │  │
│  │  │  SCAN_URL  │    │     ANALYZE_CODE       │      │  │
│  │  │ (API call) │    │   (Qwen3.5 + OWASP)   │      │  │
│  │  └─────┬──────┘    └───────────────────────┘      │  │
│  │        │                                           │  │
│  │  ┌─────▼──────┐    ┌───────────────────────┐      │  │
│  │  │  RED_TEAM  │    │    SECURITY_REPORT     │      │  │
│  │  │  (Qwen3.5) │    │  (Qwen3.5 + Grading)  │      │  │
│  │  └────────────┘    └───────────────────────┘      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────┐  ┌───────────────────────────┐   │
│  │ plugin-bootstrap │  │  plugin-openai             │   │
│  └──────────────────┘  │  (→ Nosana Qwen3.5-27B)   │   │
│                        └───────────────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────▼──────────────┐
          │   ShieldNet Scanner API      │
          │   scan.bughunt.tech          │
          │   26+ attack vectors         │
          └──────────────┬──────────────┘
                         │
          ┌──────────────▼──────────────┐
          │   Nosana GPU Network         │
          │   Qwen3.5-27B-AWQ-4bit       │
          │   Decentralized inference    │
          └──────────────────────────────┘
```

---

## Setup

### Prerequisites

- Node.js 23+
- pnpm
- bun

```bash
git clone https://github.com/hhhashexe/agent-challenge
cd agent-challenge
pnpm install
cp .env.example .env
pnpm start
```

Open [http://localhost:3000](http://localhost:3000).

### Docker

```bash
docker build -t shieldnet-elizaos .
docker run -p 3000:3000 --env-file .env shieldnet-elizaos
```

### Nosana Deployment

```bash
npm install -g @nosana/cli
nosana job post --file nos_job_def/shieldnet.json --market gpu
```

---

## Scanning Engine

`SCAN_URL` calls [scan.bughunt.tech](https://scan.bughunt.tech) — 26+ attack vectors:

- **Injection**: SQL injection, XSS (reflected/stored/DOM), command injection
- **SSRF**: Server-side request forgery
- **CORS**: Cross-origin misconfiguration
- **Headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **SSL/TLS**: Certificate validity, protocol versions, weak ciphers (RC4, DES, EXPORT)
- **Ports**: Exposed services on common ports
- **DNS**: Zone transfer, DNSSEC, SPF/DKIM/DMARC

## Grading

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90–100 | Clean |
| B | 75–89 | Minor issues |
| C | 60–74 | Multiple issues requiring attention |
| D | 40–59 | Serious vulnerabilities present |
| F | 0–39 | Critical — immediate action required |

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Set to `nosana` for Nosana inference | Yes |
| `OPENAI_API_URL` | Nosana Qwen3.5 endpoint | Yes |
| `MODEL_NAME` | Model identifier | Yes |
| `OPENAI_EMBEDDING_URL` | Nosana embedding endpoint | Yes |
| `OPENAI_EMBEDDING_MODEL` | Embedding model name | Yes |
| `OPENAI_EMBEDDING_DIMENSIONS` | Embedding dimensions (1024) | Yes |
| `SERVER_PORT` | HTTP port (default: 3000) | No |

---

## Project Structure

```
├── src/
│   ├── index.ts                  # ShieldNet plugin — 9 actions
│   └── project.ts                # ElizaOS v2 project entry point
├── characters/
│   └── agent.character.json      # Character definition
├── nos_job_def/
│   └── shieldnet.json            # Nosana job manifest
├── Dockerfile
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent Framework | ElizaOS v2 |
| LLM | Qwen3.5-27B-AWQ-4bit via Nosana |
| Embedding | Qwen3-Embedding-0.6B via Nosana |
| Scanner | ShieldNet API (scan.bughunt.tech) |
| Runtime | Node.js 23 + Bun |
| Language | TypeScript (ESM) |
| Container | Docker (node:23-alpine) |
| Deployment | Nosana GPU Network |

---

## Nosana Integration

ShieldNet is built on Nosana from the ground up — not just deployed there.

### Why Nosana for Security Tooling

Security scans expose sensitive data: internal endpoints, SSL certs, open ports, vulnerability details. **This data must not go through centralized API providers.** Nosana's decentralized GPU network ensures:

- 🔒 **Privacy-first**: scan data processed on your dedicated node, not OpenAI's servers
- 🌐 **Decentralized**: no single point of failure; nodes rescheduled automatically
- ⚡ **GPU-accelerated**: Qwen3.5-27B runs on A100/H100 for fast, high-quality analysis
- 🔗 **Verifiable**: every job recorded on Solana — cryptographic proof of execution
- 💰 **Cost-effective**: market pricing, not per-token API markup

### What Runs on Nosana

| Component | Nosana Role | Model / Container |
|-----------|-------------|------------------|
| LLM Inference | GPU node inference | Qwen3.5-27B-AWQ-4bit |
| Embeddings | GPU node inference | Qwen3-Embedding-0.6B (1024-dim) |
| Agent Runtime | Container deployment | shieldnet-agent:latest |
| Health Monitoring | Cron job (every 5 min) | curlimages/curl probes |

### Actions Using Nosana LLM

Every action that requires reasoning — `ANALYZE_CODE`, `RED_TEAM`, `SECURITY_REPORT`, `SCAN_GITHUB` — routes through the Nosana Qwen3.5-27B endpoint. Even the memory/RAG system uses Nosana embeddings for storing and retrieving conversation context.

### Job Definitions

Three Nosana job manifests in `nos_job_def/`:

```
nos_job_def/
├── shieldnet.json            # Single-container agent deployment
├── shieldnet-pipeline.json   # Multi-op: scanner API + agent (orchestration)
└── shieldnet-monitoring.json # Cron health + latency probes (every 5 min)
```

**Pipeline job** (`shieldnet-pipeline.json`) runs two containers with dependency ordering:
1. `shieldnet-scanner-api` — isolated scanner service on port 8080
2. `shieldnet-eliza-agent` — LLM agent, depends on scanner, connects via internal network

This demonstrates Nosana's multi-operation orchestration: security-boundary isolation between the network-exposed scanner and the LLM reasoning layer.

**Monitoring job** (`shieldnet-monitoring.json`) is a cron-scheduled job that probes:
- Agent HTTP endpoint
- Nosana LLM `/v1/models` endpoint  
- Nosana Embedding `/v1/models` endpoint
- Scanner API `/health`

Plus a latency breakdown op (DNS → TCP → TLS → TTFB) for performance tracking.

### Health Check Action

The `HEALTH_CHECK` action actively probes Nosana endpoints at query time. Ask the agent:

```
You: status
You: are you running?
You: health

ShieldNet: ShieldNet Agent — System Status
           Status: 🟢 RUNNING  |  Uptime: 47m 12s

           Nosana GPU Infrastructure
             ✅ LLM:        Qwen3.5-27B-AWQ-4bit (234ms)
             ✅ Embeddings: Qwen3-Embedding-0.6B (189ms)

           Scanner API
             ✅ scan.bughunt.tech (145ms)
```

### Automated Deployment

`deploy.sh` handles the full deploy lifecycle:

```bash
./deploy.sh gpu 30
# → Docker build + tag
# → Push to ghcr.io
# → nosana job post --file nos_job_def/shieldnet.json --market gpu
# → Wait for node URL
# → Health check validation
```

### Project Structure (Updated)

```
├── src/
│   └── index.ts                      # 10 actions incl. HEALTH_CHECK
├── nos_job_def/
│   ├── shieldnet.json                # Single-container deploy
│   ├── shieldnet-pipeline.json       # Multi-op pipeline (scanner + agent)
│   └── shieldnet-monitoring.json     # Cron health monitoring
├── deploy.sh                         # Automated Nosana deployment script
├── NOSANA_INTEGRATION.md             # Deep dive into Nosana integration
└── ...
```

→ See [NOSANA_INTEGRATION.md](./NOSANA_INTEGRATION.md) for the full architecture deep dive.

---

## About

Built by [Hash Security](https://scan.bughunt.tech). CVEs discovered: GHSA-j73w (9.1 Critical), GHSA-cqrc (7.1 High), GHSA-c9jw (7.5 High).

Nosana x ElizaOS Agent Challenge entry. Decentralized GPU inference — your scan data doesn't touch centralized servers.

MIT License.
