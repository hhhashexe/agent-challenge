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

## About

Built by [Hash Security](https://scan.bughunt.tech). CVEs discovered: GHSA-j73w (9.1 Critical), GHSA-cqrc (7.1 High), GHSA-c9jw (7.5 High).

Nosana x ElizaOS Agent Challenge entry. Decentralized GPU inference — your scan data doesn't touch centralized servers.

MIT License.
