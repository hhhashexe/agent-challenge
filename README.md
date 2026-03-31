# 🛡️ ShieldNet — AI Security Agent

> Personal AI cybersecurity agent built on ElizaOS v2, powered by Nosana decentralized GPU network.

## What is ShieldNet?

ShieldNet is an AI security agent that scans websites for vulnerabilities through natural conversation. Ask it to scan a URL, review code, or generate attack narratives — it handles the rest.

**Built for the Nosana Builders Challenge: ElizaOS**

## Features

- 🔍 **URL Scanning** — Scans websites for XSS, SQLi, SSRF, CORS, headers, SSL, ports, DNS vulnerabilities
- 💻 **Code Analysis** — Reviews code for OWASP Top 10 security issues with fix suggestions
- 🔴 **Red Team Reports** — Generates realistic attack narratives showing how vulns could be exploited
- 📊 **Security Reports** — Executive summaries with A-F grades and prioritized remediation

## Tech Stack

- **Framework:** ElizaOS v2
- **Model:** Qwen3.5-27B-AWQ-4bit (Nosana hosted endpoint)
- **Scanner:** ShieldNet API (26+ attack vectors, 3 CVEs discovered)
- **Infrastructure:** Nosana decentralized GPU network
- **Runtime:** Node.js 23, Docker

## Architecture

```
User ←→ ElizaOS Chat UI ←→ ShieldNet Plugin
                                    ↓
                          ShieldNet API (scan.bughunt.tech)
                                    ↓
                          26+ Security Checks
                          (XSS, SQLi, SSRF, CORS, SSL, Ports, DNS...)
                                    ↓
                          Qwen3.5-27B (Nosana GPU)
                          Analysis & Report Generation
```

## Quick Start

```bash
git clone https://github.com/hhhashexe/agent-challenge
cd agent-challenge
cp .env.example .env
pnpm install
pnpm dev
# Open http://localhost:3000
```

## Example Conversations

**Scan a website:**
> User: Scan https://example.com for vulnerabilities
> ShieldNet: Initiating security scan... Found 3 high, 2 medium issues. Missing CSP header, weak SSL cipher...

**Review code:**
> User: Is this safe? `db.query("SELECT * FROM users WHERE id=" + req.params.id)`
> ShieldNet: 🚨 Critical: SQL Injection. Use parameterized queries instead...

**Red team analysis:**
> User: How would a hacker exploit these findings?
> ShieldNet: Based on the CORS wildcard + missing CSP, an attacker could chain...

## Docker Deployment

```bash
docker build -t shieldnet-agent .
docker run -p 3000:3000 --env-file .env shieldnet-agent
```

## Nosana Deployment

Deploy using the job definition in `nos_job_def/shieldnet.json`.

## About

Built by [Hash Security](https://bughunt.tech) for the Nosana Builders Challenge.
- 3 CVEs discovered (GHSA-j73w, GHSA-cqrc, GHSA-c9jw)
- 26+ attack vectors
- npm: `shieldnet` | GitHub Action: `hhhashexe/shieldnet-action`

## License

MIT
