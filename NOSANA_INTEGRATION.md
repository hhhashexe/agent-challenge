# Nosana Integration — ShieldNet

Deep dive into how ShieldNet leverages Nosana's decentralized GPU network — not just as a deployment target, but as a core architectural component.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        User / Client                                    │
│              (Telegram, Discord, REST, Web UI)                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 Nosana GPU Node  (shieldnet.node.k8s.prd.nos.ci)        │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    ElizaOS v2 Agent                              │   │
│  │                                                                  │   │
│  │   ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐ │   │
│  │   │ HEALTH_CHECK │  │   SCAN_URL    │  │    ANALYZE_CODE      │ │   │
│  │   │  (uptime,    │  │ (scan.bughunt │  │  (OWASP Top 10 +     │ │   │
│  │   │  Nosana      │  │  .tech API)   │  │   Qwen3.5 reasoning) │ │   │
│  │   │  endpoint    │  └──────┬────────┘  └──────────┬───────────┘ │   │
│  │   │  probes)     │         │                       │             │   │
│  │   └──────────────┘         └──────────┬────────────┘             │   │
│  │                                        │                          │   │
│  │   ┌──────────────┐  ┌──────────────┐   │  ┌──────────────────┐  │   │
│  │   │   RED_TEAM   │  │  SECURITY_   │   │  │  SCAN_GITHUB     │  │   │
│  │   │  (Qwen3.5    │  │  REPORT      │   │  │  (secrets +      │  │   │
│  │   │   attack     │  │  (A-F grade) │   │  │   misconfigs)    │  │   │
│  │   │   chains)    │  └──────────────┘   │  └──────────────────┘  │   │
│  │   └──────────────┘                     │                          │   │
│  └────────────────────────────────────────┼──────────────────────────┘   │
│                                           │                              │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Nosana LLM Inference Layer                          │   │
│  │                                                                  │   │
│  │  ┌────────────────────────────────┐  ┌───────────────────────┐  │   │
│  │  │   Qwen3.5-27B-AWQ-4bit         │  │  Qwen3-Embedding-0.6B │  │   │
│  │  │   (text generation, analysis,  │  │  (semantic search,    │  │   │
│  │  │    red team, code review)      │  │   memory retrieval)   │  │   │
│  │  │                                │  │                       │  │   │
│  │  │   GPU: A100 / H100             │  │   GPU: accelerated    │  │   │
│  │  │   VRAM: 80GB                   │  │   Dims: 1024          │  │   │
│  │  └────────────────────────────────┘  └───────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────▼─────────────────┐
              │   ShieldNet Scanner API             │
              │   scan.bughunt.tech                 │
              │                                     │
              │   26+ attack vectors:               │
              │   XSS · SQLi · SSRF · CORS          │
              │   headers · SSL · ports · DNS        │
              └─────────────────────────────────────┘
```

---

## Why Nosana

### 1. Privacy-First Security Analysis

Security scans are sensitive. When you scan a production application, the results contain:
- Vulnerability details that could be exploited
- Internal endpoint structures
- SSL certificate info, open ports, service fingerprints
- Potentially proprietary code snippets (for code review)

**Centralized inference (OpenAI, Anthropic) means your scan data goes through their servers and is logged.** This is unacceptable for security tooling.

Nosana solves this:
- The LLM runs on a GPU node you're paying for, not a shared API farm
- Scan data is processed on that node and never leaves the Nosana network
- No training data collection, no retained logs
- Cryptographically verifiable execution (Solana on-chain proof)

### 2. Decentralized — No Single Point of Failure

Traditional AI APIs have outages. OpenAI had [multiple incidents in 2023-2024](https://status.openai.com). For a security scanner, being unavailable during an incident response is a hard failure.

Nosana's network:
- Hundreds of GPU nodes globally
- Jobs automatically rescheduled if a node fails
- No single API gateway to DDOS or take down
- SLA backed by economic incentives (node operators stake NOS)

### 3. Cost-Effective GPU Inference

Running Qwen3.5-27B on OpenAI-compatible endpoints at scale would cost $0.01-0.03 per 1K tokens. Nosana's market pricing is significantly lower because:
- Supply-side competition between GPU node operators
- Pay-per-job, not pay-per-token (predictable pricing)
- No markup for corporate overhead

### 4. On-Chain Verifiability

Every job posted to Nosana is recorded on Solana:
- Job ID is a Solana transaction
- Execution proof is written on-chain
- Audit trail for compliance (SOC2, GDPR)

This matters for security products: customers can independently verify that their scan was executed on a specific node configuration.

---

## Integration Depth

### LLM Inference (Primary)

```
OPENAI_API_URL=https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1
MODEL_NAME=Qwen3.5-27B-AWQ-4bit
OPENAI_API_KEY=nosana
```

Used by: `ANALYZE_CODE`, `RED_TEAM`, `SECURITY_REPORT`, `SCAN_GITHUB` — all heavy reasoning tasks.

Qwen3.5-27B was chosen specifically because:
- Strong at security domain reasoning (trained on security papers, CVE databases)
- 27B parameters = better nuance than 7B/13B models for vulnerability analysis
- AWQ 4-bit quantization fits in GPU VRAM while preserving quality
- OpenAI-compatible API (drop-in with `plugin-openai`)

### Embedding Inference (Memory / RAG)

```
OPENAI_EMBEDDING_URL=https://4yiccatpyxx773jtewo5ccwhw1s2hezq5pehndb6fcfq.node.k8s.prd.nos.ci/v1
OPENAI_EMBEDDING_MODEL=Qwen3-Embedding-0.6B
OPENAI_EMBEDDING_DIMENSIONS=1024
```

Used by: ElizaOS core memory system — conversation history, action retrieval, context recall.

This means **the entire memory pipeline is on Nosana**, not just the chat responses. When ShieldNet retrieves a past scan from memory, the embedding lookup happens on a Nosana GPU.

### Agent Runtime (Container Deployment)

The ElizaOS agent itself runs in a container on Nosana:

```json
// nos_job_def/shieldnet.json
{
  "ops": [{
    "type": "container/run",
    "args": {
      "image": "ghcr.io/hhhashexe/shieldnet-agent:latest",
      "expose": 3000
    }
  }]
}
```

The exposed port 3000 is proxied through Nosana's ingress to a public `.nos.ci` subdomain — no manual nginx, no Cloudflare, no SSL cert management.

### Multi-Operation Pipeline (Advanced)

`nos_job_def/shieldnet-pipeline.json` demonstrates a **two-container pipeline**:

```
[Op 1: shieldnet-scanner-api] → [Op 2: shieldnet-eliza-agent]
```

- Op 1 runs the scanner service in isolation (CPU-light, security-boundary)
- Op 2 runs the LLM agent, connecting to Op 1 via internal network
- Op 2 has `"needs": ["shieldnet-scanner-api"]` — Nosana orchestrates startup order

This pattern enables:
- **Security isolation**: scanner API (network-exposed) ↔ LLM agent (internal) with no cross-contamination
- **Independent scaling**: spin up more scanner nodes without touching LLM infra
- **Failure isolation**: scanner crash doesn't kill the agent

### Health Monitoring (Operational)

`nos_job_def/shieldnet-monitoring.json` defines a **cron-triggered monitoring job**:

```json
"meta": {
  "trigger": "cron",
  "schedule": "*/5 * * * *"
}
```

Every 5 minutes, a lightweight `curlimages/curl` container probes:
1. Agent endpoint (HTTP 2xx/3xx)
2. Nosana LLM `/v1/models` (endpoint liveness)
3. Nosana Embedding `/v1/models`
4. Scanner API `/health`

Plus a **latency probe** op that measures DNS, TCP, TLS, and TTFB breakdown — useful for detecting Nosana node performance degradation before users notice.

### HEALTH_CHECK Action (Runtime Introspection)

The `HEALTH_CHECK` action (added to `src/index.ts`) responds to queries like:
- `"health"`, `"status"`, `"are you running?"`, `"ping"`, `"uptime"`

It actively probes Nosana endpoints at query time and reports:
- LLM endpoint latency
- Embedding endpoint latency
- Scanner API latency
- Memory usage, uptime, scan cache size

This is dogfooding: the agent uses its own Nosana infrastructure to verify its own Nosana infrastructure.

---

## Multi-Node Architecture (Future)

The current architecture has a single Nosana node running everything. The pipeline job definition lays the groundwork for a distributed model:

```
┌─────────────────────────────────────────────────────────────┐
│                  Future: Multi-Node ShieldNet               │
│                                                             │
│  Nosana Node A (GPU)          Nosana Node B (GPU)           │
│  ┌─────────────────┐          ┌─────────────────┐          │
│  │  Qwen3.5-27B    │          │  Scanner Engine │          │
│  │  LLM Inference  │◄────────►│  26+ vectors    │          │
│  │  + ElizaOS      │          │  API on port 80 │          │
│  └─────────────────┘          └─────────────────┘          │
│                                                             │
│  Nosana Node C (GPU)                                        │
│  ┌─────────────────┐                                        │
│  │  Qwen3-Embedding│                                        │
│  │  Dedicated node │                                        │
│  │  for RAG/memory │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

**Economic model**: Scan customers pay NOS tokens → distributed across the three specialized nodes. This maps naturally to Nosana's marketplace model.

---

## Nosana Marketplace Vision

Long-term, ShieldNet can become a **security scan compute marketplace** on Nosana:

| Role | Nosana Node Type | Description |
|------|-----------------|-------------|
| Scan Orchestrator | CPU node | Job routing, result aggregation |
| LLM Reasoner | GPU (A100) | Qwen3.5-27B for analysis |
| Port Scanner | CPU node | nmap-style concurrent scanning |
| Web Crawler | CPU node | JavaScript rendering, form detection |
| Exploit Simulator | GPU node | ML-based payload fuzzing |

Users post a "scan job" to Nosana marketplace → nodes bid based on availability and price → scan executes across the optimal node configuration → result returned to user.

This is the security scanning equivalent of what Render Network does for video rendering.

---

## Job Definitions Summary

| File | Purpose | Trigger |
|------|---------|---------|
| `nos_job_def/shieldnet.json` | Single-container agent deploy | CLI / manual |
| `nos_job_def/shieldnet-pipeline.json` | Scanner + agent two-container pipeline | CLI / CI |
| `nos_job_def/shieldnet-monitoring.json` | Health + latency probes | Cron (every 5 min) |

---

## Deployment Flow

```
git push → CI builds image → docker push ghcr.io/hhhashexe/shieldnet-agent:latest
                                        ↓
                              ./deploy.sh gpu 30
                                        ↓
                         nosana job post --file nos_job_def/shieldnet.json
                                        ↓
                    Nosana scheduler assigns GPU node
                                        ↓
                    Node pulls image from GHCR
                                        ↓
                    Container starts, port 3000 exposed
                                        ↓
               https://<node-id>.node.k8s.prd.nos.ci → live agent
```

See `deploy.sh` for the full automated deployment script with health checking.

---

## Environment Variables

All Nosana-specific config is injected via the job definition — no secrets hardcoded:

```bash
OPENAI_API_KEY=nosana                   # auth for Nosana LLM endpoint
OPENAI_API_URL=https://...nos.ci/v1     # Nosana Qwen3.5 node
MODEL_NAME=Qwen3.5-27B-AWQ-4bit
OPENAI_EMBEDDING_URL=https://...nos.ci/v1
OPENAI_EMBEDDING_API_KEY=nosana
OPENAI_EMBEDDING_MODEL=Qwen3-Embedding-0.6B
OPENAI_EMBEDDING_DIMENSIONS=1024
```

These are injected at job-post time, not baked into the image — enabling the same image to be deployed against different Nosana nodes or model endpoints without rebuilding.
