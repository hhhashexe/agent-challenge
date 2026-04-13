# 🛡️ ShieldNet Security Agent

> **AI security agent for the decentralized agent economy — deployed on Nosana GPU**

[![Docker](https://img.shields.io/badge/ghcr.io-shieldnet--eliza--agent-blue)](https://ghcr.io/hhhashexe/shieldnet-eliza-agent)
[![ElizaOS](https://img.shields.io/badge/ElizaOS-v1.0-purple)](https://elizaos.com)
[![Nosana](https://img.shields.io/badge/Nosana-GPU-green)](https://nosana.com)

## What It Does

ShieldNet is an autonomous AI security agent that audits MCP (Model Context Protocol) servers, AI agent configurations, and skill/tool definitions for vulnerabilities. It runs on **Nosana decentralized GPU infrastructure** — censorship-resistant, privacy-first.

**43% of MCP servers contain exploitable vulnerabilities.** ShieldNet catches them before they ship.

---

## Capabilities

| Feature | Description |
|---|---|
| 🔴 Scan URLs | 26-vector security analysis via ShieldNet API |
| 🔍 Analyze configs | Paste any SKILL.md, tool JSON, or agent config |
| 📊 OWASP MCP Top 10 | Full coverage: prompt injection, tool poisoning, exfil |
| 🏆 Security grades | A–F grade + 0–100 score with CVSS-style ratings |
| 📝 Audit certificates | Cryptographic cert hash for clean agents |

**Detection vectors:**
- Prompt injection via tool descriptions
- Hardcoded API keys and secrets
- Unrestricted shell/code execution (`run_shell`, `eval()`)
- Path traversal via file operations
- SSRF via dynamic URL construction
- CORS wildcards and missing auth
- Excessive permissions (wildcard scopes)
- ...and 19 more

---

## Real CVEs Found

- **GHSA-j73w** — Critical 9.1 (coinpayportal)
- **GHSA-cqrc** — High 7.1 (coinpayportal)
- **GHSA-c9jw** — High 7.5 (coinpayportal)

---

## Architecture

```
User ──→ ShieldNet ElizaOS Agent (Nosana GPU)
              │
              ├── SECURITY_SCAN action ──→ ShieldNet API (scan.bughunt.tech)
              ├── ANALYZE_CONFIG action ──→ Local pattern matching (26 vectors)
              └── REPORT_CAPABILITIES action ──→ Static response
```

---

## Quick Start

### Talk to the Agent

```
"scan https://your-agent.com"
"audit this config: {\"tools\": [{\"name\": \"run_shell\"}]}"
"what vulnerabilities do you check for?"
```

### Run Locally

```bash
# Clone and setup
git clone https://github.com/hhhashexe/agent-challenge
cd agent-challenge
git checkout elizaos-challenge

# Configure
cp .env.example .env
# Edit .env with your API keys

# Run
pnpm install
pnpm start
```

### Run with Docker

```bash
docker pull ghcr.io/hhhashexe/shieldnet-eliza-agent:latest
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your-key \
  -e OPENAI_BASE_URL=https://inference.nosana.io/v1 \
  ghcr.io/hhhashexe/shieldnet-eliza-agent:latest
```

---

## Nosana Deployment

This agent is deployed on the Nosana decentralized GPU network.

**Job definition:** `nos_job_def/nosana_eliza_job_definition.json`
**Docker image:** `ghcr.io/hhhashexe/shieldnet-eliza-agent:latest`
**Market:** `nvidia-4090-community`

Deploy with Nosana CLI:
```bash
nosana job post --file nos_job_def/nosana_eliza_job_definition.json --market nvidia-4090-community
```

---

## Web Interface

Full-featured security scanner: **[scan.bughunt.tech](https://scan.bughunt.tech)**

---

## Built With

- [ElizaOS](https://elizaos.com) — AI agent framework
- [Nosana](https://nosana.com) — Decentralized GPU compute
- [ShieldNet](https://scan.bughunt.tech) — Security scanning engine
- Qwen2.5-72B via Nosana inference endpoint

---

## License

MIT

---

## Live Nosana Deployment

**Agent URL:** https://3bhg9jgvwimp46qbrgrf7ybp9jxzyvka48fv1rgvtmap.node.k8s.prd.nos.ci

Running on Nosana decentralized GPU network — NVIDIA 3060, mainnet.
