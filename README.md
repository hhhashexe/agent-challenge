# 🛡️ ShieldNet — AI-Powered Cybersecurity Agent

> **Nosana x ElizaOS Agent Challenge Entry**  
> Built by [Hash Security](https://scan.bughunt.tech)

ShieldNet is an AI-powered cybersecurity agent that scans websites, APIs, and code for vulnerabilities. It combines 26+ attack vectors with LLM-powered analysis to deliver actionable security reports — all running on decentralized GPU infrastructure.

[![ElizaOS v2](https://img.shields.io/badge/ElizaOS-v2-blue)](https://github.com/elizaos/eliza)
[![Nosana](https://img.shields.io/badge/Powered%20by-Nosana-purple)](https://nosana.io)
[![Qwen3.5-27B](https://img.shields.io/badge/Model-Qwen3.5--27B-orange)](https://huggingface.co/Qwen)
[![Nosana Builders Challenge](https://img.shields.io/badge/Built%20for-Nosana%20Builders%20Challenge-success)](https://nosana.io)

## 🎯 What It Does

ShieldNet is a security-focused AI agent you chat with to scan websites, review code, and explore your security posture:

| Action | Trigger | Description |
|--------|---------|-------------|
| **SCAN_URL** | `scan https://target.com` | Full vulnerability scan — XSS, SQLi, SSRF, CORS, headers, SSL, ports, DNS. Emoji-grouped findings with actionable next steps. |
| **ANALYZE_CODE** | Paste code + "review" | OWASP Top 10 code review with fix suggestions |
| **RED_TEAM** | `generate red team report` | Attack narrative — realistic exploitation scenarios chained from findings |
| **SECURITY_REPORT** | `security report` | Executive summary with A-F grade, business impact, remediation priority |
| **SCAN_HISTORY** | `show my scan history` | Numbered list of all cached scans with grades, scores, and timestamps |
| **COMPARE_SITES** | `compare site1.com vs site2.com` | Side-by-side security comparison table of two URLs |
| **SCAN_GITHUB** | `scan github.com/user/repo` | Repo audit — hardcoded secrets, dangerous deps, misconfigs, missing security files |
| **EXPORT_REPORT** | `export report` | Full markdown security report ready to share with your team |
| **SELF_SCAN** | `scan yourself` | Meta action: agent scans its own infrastructure with personality commentary |

## 🏗️ Architecture

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
└────────────────────────────┬────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   ShieldNet Scanner API      │
              │   scan.bughunt.tech          │
              │   26+ attack vectors         │
              └──────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │   Nosana GPU Network         │
              │   Qwen3.5-27B-AWQ-4bit       │
              │   Decentralized inference    │
              └──────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 23+
- pnpm (`npm install -g pnpm`)
- bun (`npm install bun` or https://bun.sh)

### Setup

```bash
# Clone the repo
git clone https://github.com/hhhashexe/agent-challenge
cd agent-challenge

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# The .env.example already has the Nosana Qwen3.5-27B endpoint pre-configured

# Start the agent
pnpm start
```

Open [http://localhost:3000](http://localhost:3000) to chat with ShieldNet.

### Development Mode

```bash
pnpm dev
```

## 💬 Example Conversations

### URL Security Scan

```
You: Scan https://example.com for vulnerabilities

ShieldNet: 🛡️ ShieldNet Scan Initiated
           Target: https://example.com
           Scanning for vulnerabilities across 26+ attack vectors...

           🛡️ ShieldNet Scan Complete
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━
           Target: https://example.com
           Grade: C (62/100)
           Findings: 8 total

           🔴 CRITICAL (1)
             • Missing Content-Security-Policy — XSS attacks may succeed
               Fix: Add CSP header: Content-Security-Policy: default-src 'self'

           🟠 HIGH (2)
             • Missing HSTS — Man-in-the-middle/downgrade risk
             • CORS allows any origin — Cross-origin data theft possible

           🟡 MEDIUM (3)
             • X-Frame-Options missing — Clickjacking risk
             ...

           💡 Use "red team report" to see attack narratives
```

### Code Security Review

```
You: Review this code for security issues:
     ```js
     app.get('/user', (req, res) => {
       db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);
     });
     ```

ShieldNet: 🔍 ShieldNet Code Analysis
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━

           🔴 CRITICAL: SQL Injection (OWASP A03)
           The user input `req.query.id` is directly concatenated into the SQL
           query without parameterization.

           Vulnerable code:
             db.query(`SELECT * FROM users WHERE id = ${req.query.id}`)

           Fix — Use parameterized queries:
             db.query('SELECT * FROM users WHERE id = ?', [req.query.id])

           Impact: Attacker can inject `1 OR 1=1` to dump the entire users
           table, or `1; DROP TABLE users;--` to destroy data.
```

### Red Team Report

```
You: Generate a red team report

ShieldNet: 🔴 ShieldNet Red Team Report
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━
           Target: https://example.com

           Attack Chain 1: Session Hijacking via XSS + Missing HSTS
           Skill Level: Intermediate | Time to exploit: 2-4 hours

           Step 1: Attacker discovers reflected XSS via search parameter...
           Step 2: Missing HSTS allows HTTP downgrade...
           Step 3: Session cookie captured via network MITM...

           Worst-Case Scenario: Full account takeover of admin users...
```

### Executive Security Report

```
You: Give me a security report

ShieldNet: 📊 ShieldNet Executive Security Report
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           Target: https://example.com
           Grade: 🟡 C (62/100)
           Date: 2025-01-15

           Findings Breakdown:
           🔴 Critical: 1 | 🟠 High: 2 | 🟡 Medium: 3 | 🔵 Low: 2

           Overall Assessment: The target has several security gaps that
           could be exploited by motivated attackers...

           Business Impact: Estimated breach cost $1.2M based on data
           exposure risk...
```

### Scan History

```
You: Show my scan history

ShieldNet: 📋 ShieldNet Scan History (3 scans)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━

           1. 🟢 A (96/100) — https://secure.example.com
              🔴0 🟠0 🟡2 🔵1 | 2025-01-15 10:30:00 UTC

           2. 🟡 C (62/100) — https://app.example.com
              🔴1 🟠2 🟡3 🔵2 | 2025-01-15 11:05:00 UTC

           3. 🔴 F (18/100) — https://legacy.example.com
              🔴4 🟠3 🟡2 🔵1 | 2025-01-15 11:42:00 UTC
```

### Compare Sites

```
You: Compare https://secure.example.com vs https://legacy.example.com

ShieldNet: ⚖️ ShieldNet Security Comparison
           Scanning both targets...

                              secure.example.com    legacy.example.com
           ─────────────────────────────────────────────────────────────
           Grade              🟢 A (96/100)         🔴 F (18/100)
           Total Findings     3                     10
           🔴 Critical        0                     4
           🟠 High            0                     3
           🟡 Medium          2                     2
           🔵 Low             1                     1

           🏆 Winner: secure.example.com is more secure by 78 points.
```

### GitHub Repo Scan

```
You: Scan github.com/myorg/myapp for security issues

ShieldNet: 🔍 ShieldNet GitHub Scan
           Repo: https://github.com/myorg/myapp
           Fetching repository files... ⏳

           🔴 CRITICAL: Hardcoded API Key in package.json
             Found: STRIPE_SECRET_KEY=sk_live_abc123...
             Fix: Move to environment variable and rotate immediately.

           🟠 HIGH: .env not in .gitignore
             Your .env file may be in git history.
             Fix: Add .env to .gitignore; run git filter-repo to purge.

           🟡 MEDIUM: Outdated dependency (express 4.17.1)
             CVE-2022-24999 — ReDoS vulnerability.
             Fix: npm update express

           Overall Risk: D (45/100)
```

### Export Markdown Report

```
You: Export report

ShieldNet: 📄 ShieldNet Markdown Report

           # ShieldNet Security Report

           ## Scan Metadata
           | Field       | Value                  |
           |-------------|------------------------|
           | Target      | https://example.com    |
           | Scan Date   | 2025-01-15T11:05:00Z   |
           | Grade       | C (62/100)             |
           | Critical    | 1                      |
           ...

           [Full markdown with all findings grouped by severity + remediation roadmap]
```

### Self-Scan

```
You: Scan yourself

ShieldNet: 🤖 Let me turn the scanner on myself... interesting.

           🛡️ ShieldNet Self-Scan Initiated
           Target: https://scan.bughunt.tech (that's me)

           Scanning headers... ⏳
           Checking my own SSL certificate... ⏳
           Hacker mode: ON

           🛡️ ShieldNet Self-Scan Results
           Grade: 🟢 A (94/100)

           😎 Looks like I practice what I preach. Grade A — not bad for a robot.
```

## 🐳 Docker Deployment

```bash
# Build
docker build -t shieldnet-elizaos .

# Run
docker run -p 3000:3000 --env-file .env shieldnet-elizaos
```

## 🌐 Nosana Deployment

Deploy on the Nosana decentralized GPU network:

```bash
# Install Nosana CLI
npm install -g @nosana/cli

# Use the provided job definition
nosana job post --file nos_job_def/shieldnet.json --market gpu
```

The `nos_job_def/shieldnet.json` contains the full deployment manifest with:
- Docker image: `hashsecurity/shieldnet-elizaos:latest`
- Nosana Qwen3.5-27B-AWQ-4bit endpoint configuration
- Nosana embedding model configuration
- Port 3000 exposed

## 📁 Project Structure

```
├── src/
│   ├── index.ts            # ShieldNet plugin (4 actions)
│   └── project.ts          # ElizaOS v2 Project entry point
├── characters/
│   └── agent.character.json # Character definition (backup, for CLI --character flag)
├── nos_job_def/
│   └── shieldnet.json       # Nosana job definition
├── Dockerfile               # Container build
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript config
├── .env.example             # Environment template
└── README.md                # This file
```

## 🔬 Technical Details

### Scanning Engine

The `SCAN_URL` action calls [scan.bughunt.tech](https://scan.bughunt.tech) — ShieldNet's proprietary scanner that checks 26+ attack vectors:

- **Injection:** SQL injection, XSS (reflected/stored/DOM), command injection
- **SSRF:** Server-side request forgery detection
- **CORS:** Cross-origin resource sharing misconfiguration
- **Headers:** 7 critical security headers (CSP, HSTS, X-Frame-Options, etc.)
- **SSL/TLS:** Certificate validity, protocol versions, cipher strength
- **Ports:** Common ports scanned for exposed services
- **DNS:** Zone transfer, DNSSEC, SPF/DKIM/DMARC records

### Code Analysis (ANALYZE_CODE)

Uses the Nosana-hosted Qwen3.5-27B model to analyze code against OWASP Top 10:

| ID | Category |
|----|---------|
| A01 | Broken Access Control |
| A02 | Cryptographic Failures |
| A03 | Injection (SQLi, XSS, SSTI, etc.) |
| A04 | Insecure Design |
| A05 | Security Misconfiguration |
| A06 | Vulnerable Components |
| A07 | Authentication Failures |
| A08 | Data Integrity Failures |
| A09 | Logging/Monitoring Failures |
| A10 | Server-Side Request Forgery |

### Grading System

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90-100 | Excellent security posture |
| B | 75-89 | Good — minor issues only |
| C | 60-74 | Fair — several issues need attention |
| D | 40-59 | Poor — serious vulnerabilities present |
| F | 0-39 | Critical — immediate action required |

### ElizaOS v2 Plugin Architecture

The ShieldNet plugin is implemented as an ElizaOS v2 `Plugin` with:
- `name`: `"shieldnet"`
- `actions`: 4 custom actions (SCAN_URL, ANALYZE_CODE, RED_TEAM, SECURITY_REPORT)
- `providers`: none (stateless)
- `evaluators`: none

The agent is initialized via `src/project.ts` which exports a `Project` object, allowing the plugin to be loaded programmatically without relative path resolution issues.

## 🏆 Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent Framework | ElizaOS v2 |
| LLM | Qwen3.5-27B-AWQ-4bit (via Nosana) |
| Embedding | Qwen3-Embedding-0.6B (via Nosana) |
| Security Scanner | ShieldNet API (scan.bughunt.tech) |
| Runtime | Node.js 23 + Bun |
| Package Manager | pnpm |
| Language | TypeScript (ESM) |
| Container | Docker (node:23-alpine) |
| Deployment | Nosana GPU Network |

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Set to `nosana` for Nosana inference | Yes |
| `OPENAI_API_URL` | Nosana Qwen3.5 endpoint URL | Yes |
| `MODEL_NAME` | Model identifier | Yes |
| `OPENAI_EMBEDDING_URL` | Nosana embedding endpoint | Yes |
| `OPENAI_EMBEDDING_MODEL` | Embedding model name | Yes |
| `OPENAI_EMBEDDING_DIMENSIONS` | Embedding dimensions (1024) | Yes |
| `SERVER_PORT` | HTTP server port (default: 3000) | No |

## 🏆 About

**ShieldNet** is built by [Hash Security](https://scan.bughunt.tech) — a cybersecurity research team that has discovered 3 CVEs and believes security should be accessible to every developer, not just Fortune 500 companies.

This agent is our entry for the **Nosana x ElizaOS Agent Challenge**, demonstrating how decentralized GPU infrastructure can power security-focused AI agents.

### Why Nosana?

- **Privacy-first**: Your scan data stays on-chain, not logged by a central server
- **Decentralized inference**: Qwen3.5-27B runs on distributed GPU nodes
- **Cost-effective**: GPU compute at competitive rates vs centralized providers

## 📄 License

MIT — see [LICENSE](LICENSE)

---

*Built with ❤️ by Hash Security | Powered by Nosana GPU Network*
