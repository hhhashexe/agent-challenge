# 🏗️ ShieldNet Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│  (Chat API, Discord, Telegram, Web UI, CLI)                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ElizaOS v2 Runtime                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Agent Runtime with State Management & Memory             │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  ShieldNet       │ │  OpenAI Plugin   │ │  Bootstrap       │
│  Security Plugin │ │  (Qwen3.5-27B)   │ │  Plugin          │
│                  │ │  via Nosana      │ │  (Persistence)   │
│  • SCAN_URL      │ │                  │ │                  │
│  • ANALYZE_CODE  │ │  ┌────────────┐  │ │  ┌──────────────┐│
│  • RED_TEAM      │ │  │ LLM Models │  │ │  │ SQLite DB    ││
│  • SECURITY_REPO │ │  │ ┌─────────┐│  │ │  │ Memory Store ││
│                  │ │  │ │Qwen3.5- ││  │ │  │ Agent State  ││
│  ┌────────────┐  │ │  │ │27B(LLM) ││  │ │  └──────────────┘│
│  │ShieldNet   │  │ │  │ ├─────────┤│  │ │                  │
│  │Scanner API │  │ │  │ │Qwen3-   ││  │ │                  │
│  │(Internal)  │  │ │  │ │Emb(Emb) ││  │ │                  │
│  │26+ Vectors │  │ │  │ └─────────┘│  │ │                  │
│  └────────────┘  │ │  └────────────┘  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
         │                                        │
         ▼                                        ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│ ShieldNet Scanner Service    │ │  Scan Cache & Memory Index   │
│ scan.bughunt.tech/scan/url   │ │  (In-Process Map)            │
│                              │ │                              │
│ • XSS Detection              │ │ Stores recent scan results   │
│ • SQLi Detection             │ │ for RED_TEAM & SECURITY_REPO │
│ • SSRF Detection             │ │ contextual generation        │
│ • CORS Misconfiguration      │ │                              │
│ • Security Headers           │ │                              │
│ • SSL/TLS Validation         │ │                              │
│ • Port Scanning              │ │                              │
│ • DNS Analysis               │ │                              │
│ • 18+ more vectors           │ │                              │
└──────────────────────────────┘ └──────────────────────────────┘
```

## Component Details

### 1. **ShieldNet Security Plugin** (`src/index.ts`)

**Responsibilities:**
- Define 4 security-focused actions
- Validate user intent and extract parameters
- Handle API calls to ShieldNet Scanner
- Format results with severity levels and emojis
- Manage scan cache for contextual generation

**Technology:**
- TypeScript with ElizaOS v2 Plugin API
- Async/await for API calls with timeout handling
- In-memory Map for scan cache

**Actions:**

#### SCAN_URL
```
Input: URL in user message
↓
Validate URL extraction (regex)
↓
Fetch from ShieldNet Scanner API (120s timeout)
↓
Cache result (target → ScanResult)
↓
Calculate grade (A-F) + format findings
↓
Output: Formatted report with emoji severity indicators
```

#### ANALYZE_CODE
```
Input: Code block (```...```) or code-like text
↓
Extract code from markdown or raw text
↓
Build OWASP Top 10 analysis prompt
↓
Call Qwen3.5-27B via OpenAI Plugin
↓
Output: Structured vulnerability analysis with fix suggestions
```

#### RED_TEAM
```
Input: (implicit) Last cached scan result
↓
Fetch most recent scan from cache
↓
If no vulnerabilities: respond "nothing to exploit"
↓
Otherwise: build attack narrative prompt
↓
Call Qwen3.5-27B for realistic attack chains
↓
Output: Multi-step exploitation scenarios with impact
```

#### SECURITY_REPORT
```
Input: (implicit) Last cached scan result
↓
Fetch most recent scan + calculate grade
↓
Build executive summary prompt
↓
Call Qwen3.5-27B for business impact
↓
Fallback: Auto-generated report if LLM fails
↓
Output: Board-ready summary with remediation roadmap
```

### 2. **ElizaOS v2 Core Runtime**

**Key Interfaces Used:**
- `IAgentRuntime` — agent execution context
- `Action` — pluggable action definitions
- `Memory` — message objects with content
- `State` — agent conversation state
- `ModelType.TEXT_LARGE` — LLM invocation
- `HandlerCallback` — response streaming

**Plugin Ecosystem:**
- **@elizaos/plugin-bootstrap** — SQLite persistence, memory management
- **@elizaos/plugin-openai** — LLM provider (configured for Nosana Qwen3.5)
- **./src/index.ts** — ShieldNet plugin (custom)

### 3. **Nosana Inference Endpoints**

**LLM Endpoint (Qwen3.5-27B-AWQ-4bit)**
```
Provider: Nosana (decentralized GPU network)
URL: https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1
API: OpenAI-compatible /chat/completions
Auth: Bearer token (nosana)
Model: Qwen3.5-27B-AWQ (quantized to 4-bit for speed)
```

**Embedding Endpoint (Qwen3-Embedding-0.6B)**
```
URL: https://4yiccatpyxx773jtewo5ccwhw1s2hezq5pehndb6fcfq.node.k8s.prd.nos.ci/v1
API: OpenAI-compatible /embeddings
Model: Qwen3-Embedding-0.6B
Dimensions: 1024
Purpose: Memory indexing & semantic search
```

**Why Nosana?**
- ✅ Decentralized (privacy-first, not cloud-dependent)
- ✅ GPU network (fast inference at scale)
- ✅ Cost-effective (commodity GPU pricing)
- ✅ No vendor lock-in

### 4. **Data Flow for Each Action**

#### Scenario: URL Scan

```
User Message
  "Scan https://example.com for vulnerabilities"
           │
           ▼
ShieldNet Plugin: SCAN_URL handler
           │
           ├─ Extract URL (regex)
           │
           ├─ Validate scan intent (keywords)
           │
           ├─ Callback: "🛡️ Scan Initiated..."
           │
           ├─ Fetch from ShieldNet API
           │  https://scan.bughunt.tech/scan/url?target=
           │         │
           │         ▼
           │   (26+ attack vectors)
           │         │
           │         ▼
           │   ScanResult { grade, score, findings[] }
           │
           ├─ Cache result in scanCache Map
           │
           ├─ Format findings by severity
           │
           └─ Callback: Formatted report
                      │
                      ▼
              User sees: Grade, counts, findings grouped by severity
              
Additional info available for:
  - User asks "red team report" → Uses cached findings
  - User asks "security report" → Uses cached findings + LLM for analysis
```

#### Scenario: Code Analysis

```
User Message
  "Review this code:\n```js\n..."
           │
           ▼
ShieldNet Plugin: ANALYZE_CODE handler
           │
           ├─ Extract code (from code block or text patterns)
           │
           ├─ Build prompt: "Analyze for OWASP Top 10"
           │
           ├─ Call runtime.useModel(ModelType.TEXT_LARGE, {
           │     prompt: "...",
           │     temperature: 0.3,
           │     maxTokens: 4096
           │   })
           │
           ├─ Provider chain:
           │  OpenAI Plugin → OPENAI_API_URL (Nosana)
           │              ↓
           │  Qwen3.5-27B (4-bit quantized)
           │
           └─ Callback: Analysis with vulnerability details
                   ↓
          User sees: Critical/High/Medium/Low findings with fixes
```

## Data Structures

### ScanResult (from ShieldNet Scanner API)

```typescript
interface ScanResult {
  target: string;              // URL scanned
  score: number;               // 0-100
  grade: string;               // A-F
  findings: Finding[];         // Vulnerabilities
  ssl?: Record<string, unknown>;    // SSL/TLS details
  headers?: Record<string, string>; // HTTP headers
  ports?: PortResult[];             // Open ports
  dns?: Record<string, unknown>;    // DNS records
  duration?: number;           // Scan time in ms
}

interface Finding {
  type: string;               // "SQLi", "XSS", etc.
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;              // Short description
  description: string;        // Long description
  remediation?: string;       // How to fix
  details?: string;           // Additional context
}

interface PortResult {
  port: number;
  service: string;           // "http", "ssh", etc.
  open: boolean;
}
```

### scanCache Map

```typescript
Map<string, ScanResult>

Example:
  scanCache.set("https://example.com", scanResult);
  scanCache.get("https://example.com"); // → ScanResult
```

## Request/Response Examples

### SCAN_URL Request

```
User: "Scan https://example.com"
↓
Handler validates:
  - Has URL: ✓
  - Has scan intent: ✓
↓
Callback 1: "🛡️ ShieldNet Scan Initiated..."
↓
Fetch: GET https://scan.bughunt.tech/scan/url?target=https://example.com
↓
Wait 30-60 seconds...
↓
Response: { grade: "C", score: 65, findings: [...] }
↓
Callback 2: Full formatted report
```

### ANALYZE_CODE Request

```
User: "Review this:\n```js\ndb.query(`SELECT * FROM users WHERE id = ${id}`)\n```"
↓
Extract: "db.query(`SELECT * FROM users WHERE id = ${id}`)"
↓
Build LLM prompt (8KB)
↓
Call: POST /v1/chat/completions
  {
    "model": "Qwen3.5-27B-AWQ-4bit",
    "messages": [
      { "role": "user", "content": "Analyze code for OWASP Top 10..." }
    ],
    "temperature": 0.3,
    "max_tokens": 4096
  }
↓
Response: "🔴 CRITICAL: SQL Injection..."
↓
Callback: Analysis results
```

## State Management

**ElizaOS manages:**
- Conversation history (messages, memories)
- Agent personality (system prompt, examples)
- Settings & secrets
- Database connections (SQLite via plugin-bootstrap)

**ShieldNet manages:**
- scanCache (in-process memory for recent scans)
- Action validation (does message match intent?)

**Persistence:**
- All agent data → SQLite (.eliza/.elizadb)
- Scan cache → volatile in-memory Map (cleared on restart)

## Security Considerations

### What's Protected?

✅ **API Keys** — Stored as OPENAI_API_KEY in .env, not in code
✅ **User Data** — Scans happen on user-provided URLs, no storage
✅ **Model Privacy** — Nosana = decentralized, not vendor lock-in
✅ **Code Inputs** — Not stored, analyzed in-memory

### What's NOT Protected?

⚠️ **Scan Cache** — In-memory, visible to other processes on same host
⚠️ **Conversation Logs** — Stored in SQLite, accessible via file system
⚠️ **URLs Scanned** — Logged in agent memory (for context)

**Recommendations:**
- Run in isolated container (Docker)
- Restrict file system access to data/ directory
- Use secrets manager for API keys in production
- Rotate Nosana API tokens regularly
- Audit database for PII before backups

## Extension Points

**Adding a new action:**

```typescript
const myNewAction: Action = {
  name: "MY_ACTION",
  description: "...",
  similes: ["alias1", "alias2"],
  validate: async (runtime, message) => { ... },
  handler: async (runtime, message, state, options, callback) => { ... },
  examples: [...]
};

// Add to plugin.actions array
```

**Adding external integrations:**

```typescript
// Telegram, Discord, Slack clients loaded via ElizaOS
// Configure in character.json:
"plugins": [
  "@elizaos/plugin-telegram",
  "@elizaos/plugin-discord",
  "./src/index.ts"
]
```

**Customizing the LLM:**

```bash
# Use different model via Qwen API
MODEL_NAME=Qwen3.5-32B

# Use local Ollama instead of Nosana
OPENAI_API_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
```

## Performance Profile

| Metric | Value | Notes |
|--------|-------|-------|
| **SCAN_URL latency** | 30-60s | Depends on target complexity |
| **ANALYZE_CODE latency** | 5-15s | ~500-2000 tokens output |
| **RED_TEAM latency** | 10-20s | ~1500-3000 tokens output |
| **SECURITY_REPORT latency** | 8-15s | ~2000-4000 tokens output |
| **Memory usage (idle)** | ~150MB | Node.js + ElizaOS + plugins |
| **Memory usage (peak)** | ~800MB | During scan + LLM inference |
| **Throughput (sequential)** | ~1 scan/min | Limited by scan API |
| **Throughput (parallel)** | ~3-5 concurrent | With load balancer |

## Scaling Architecture

### Horizontal Scaling (Multiple Agents)

```
Load Balancer (nginx / HAProxy)
     │
     ├─ ShieldNet Agent #1 (port 3000)
     ├─ ShieldNet Agent #2 (port 3001)
     └─ ShieldNet Agent #3 (port 3002)

Shared Backend:
     ├─ Shared Database (PostgreSQL or managed DB)
     ├─ Redis Cache (for scan results across agents)
     └─ Nosana Inference Endpoints (shared)
```

### Vertical Scaling (More Powerful Single Agent)

```
Higher Resource Allocation:
  - 4→16 vCPU
  - 2GB→8GB RAM
  - Faster disk (SSD)
  - Larger node pool for Nosana inference
```

## Deployment Variations

| Environment | Database | Storage | Network | LLM Provider |
|-------------|----------|---------|---------|--------------|
| **Dev** | SQLite | Local disk | localhost | Nosana (cloud) |
| **Docker** | SQLite | Volume mount | Bridge | Nosana (cloud) |
| **K8s** | PostgreSQL | PV | Service mesh | Nosana (cloud) |
| **Nosana** | SQLite | Ephemeral | GPU network | Nosana (native) |

## References

- ElizaOS v2 Docs: https://elizaos.ai/docs
- Nosana Documentation: https://docs.nosana.io
- ShieldNet Scanner: https://scan.bughunt.tech
- OpenAI API Compatibility: https://platform.openai.com/docs/api-reference
