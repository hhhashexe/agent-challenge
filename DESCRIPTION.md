# ShieldNet — AI Security Agent

**Built by Hash Security · scan.bughunt.tech · 3 CVEs · Powered by Nosana**

---

Most developers ship code without knowing if it's vulnerable. Security audits cost thousands. ShieldNet fixes that — a conversational AI security agent that scans websites, reviews code, and generates real attack narratives, running entirely on decentralized GPU infrastructure.

## What ShieldNet Does

Chat with ShieldNet to:

- **Scan any URL** — 26+ attack vectors: XSS (reflected/stored/DOM), SQL injection, SSRF, CORS misconfigs, 7 security headers, SSL/TLS, open ports, DNS (SPF/DKIM/DMARC)
- **Review code** — OWASP Top 10 analysis with line-level fixes
- **Generate red team reports** — realistic attack chains showing how vulnerabilities get exploited in sequence
- **Get executive summaries** — A-F security grades with business impact and remediation roadmap
- **Audit GitHub repos** — find hardcoded secrets, vulnerable dependencies, missing security files
- **Compare two targets** — side-by-side security score comparison
- **Export markdown reports** — ready to file as security tickets

9 actions total. All backed by ShieldNet's production scanner — not a demo, not mocked.

## Why Nosana

Security data is sensitive. Your scan targets, your vulnerabilities, your infrastructure — none of it belongs on a centralized cloud provider's logs. Nosana's decentralized GPU network means ShieldNet's inference runs on distributed nodes: no vendor lock-in, no central logging, no AWS knowing what you're scanning.

The agent uses Nosana's hosted Qwen3.5-27B for LLM analysis and Qwen3-Embedding for knowledge retrieval, with a multi-operation job definition that pipelines the scanner service and agent as dependent Nosana ops with health checks.

## Credentials

Hash Security has discovered 3 CVEs. ShieldNet is available as an npm package and GitHub Action — security as infrastructure, not an afterthought.

**Try it:** `nosana job post --file nos_job_def/shieldnet.json --market nvidia-3090`
