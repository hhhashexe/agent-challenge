# ShieldNet Demo Video Script
## Nosana × ElizaOS Challenge — 60-Second Demo

**Target Duration:** 60 seconds  
**Format:** Screen recording + voiceover + text overlays  
**Tool:** OBS / Loom / ScreenStudio

---

## Pre-Production Notes

- Resolution: 1920×1080 (16:9)
- Background: Dark terminal / VS Code dark theme preferred
- Font: JetBrains Mono or similar monospace
- Color accent: Cyan `#00FFE0` on black for ShieldNet branding
- Music: Lo-fi cyberpunk, low volume (~15%)

---

## SCENE 1 — Title Card [0:00 – 0:05]

**Screen:**
```
┌─────────────────────────────────────────┐
│                                         │
│    🛡️  ShieldNet                        │
│    AI Security Agent                    │
│                                         │
│    Powered by Nosana + ElizaOS          │
│                                         │
└─────────────────────────────────────────┘
```

**Text Overlay:**  
`ShieldNet — AI Security Agent`  
`Powered by Nosana + ElizaOS`

**Voiceover:**  
*"Meet ShieldNet — an AI security agent that finds vulnerabilities while you sleep."*

**Visual:** Animated shield logo fading in, cyan glow effect.

---

## SCENE 2 — Problem Statement [0:05 – 0:15]

**Screen — Split layout or text cards:**
```
⚠️  73% of web apps have critical vulnerabilities
⚠️  Average time to detect a breach: 207 days
⚠️  Manual security audits: expensive, slow, incomplete
```

**Then transition to:**
```
💡 What if an AI agent could do the scanning 24/7?
```

**Voiceover:**  
*"Web vulnerabilities are everywhere. Reentrancy bugs, XSS, SQL injection, broken authentication — they hide in plain sight. Traditional audits are slow and expensive. There had to be a better way."*

**Visual:** Red warning icons appear one by one, then fade to a bright question mark.

---

## SCENE 3 — Live Demo: Scan Command [0:15 – 0:35]

**Screen — ElizaOS chat interface:**

> **User types:**
> ```
> scan https://httpbin.org
> ```

> **ShieldNet responds (text streams in):**
> ```
> 🛡️ ShieldNet Security Scan
> Target: https://httpbin.org
> Status: ACTIVE ✅
>
> ═══════════════════════════════
> SCANNING... (26 attack vectors)
> ═══════════════════════════════
>
> ✅ SSL/TLS: A+ Rating (TLS 1.3)
> ✅ Security Headers: 4/6 present
> ⚠️  X-Frame-Options: MISSING
> ⚠️  Content-Security-Policy: MISSING
> ✅ CORS Policy: Configured
> ⚠️  HTTP Methods: PUT/DELETE exposed
> ✅ No SQL injection vectors found
> ✅ No XSS reflected endpoints
> ⚠️  /anything endpoint: unrestricted input
>
> ───────────────────────────────
> Risk Score: 42/100 (MEDIUM)
> Critical: 0 | High: 0 | Medium: 3 | Low: 2
> Scan Time: 4.2s
> ```

**Voiceover:**  
*"Just type 'scan' followed by any URL. In seconds, ShieldNet runs 26 attack vectors — headers, CORS, SSL, injection points, exposed methods — and gives you a risk score."*

**Visual:** Text streams in with a typewriter effect. Risk meter animates from 0 to 42.

---

## SCENE 4 — Red Team Report [0:35 – 0:45]

**Screen — User types:**
```
redteam https://httpbin.org
```

**ShieldNet outputs:**
```
📋 RED TEAM REPORT — httpbin.org
Generated: 2026-03-31 23:45 UTC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
Target exposes 3 medium-severity findings.
No critical infrastructure compromise vectors found.

FINDINGS

[M-01] Missing X-Frame-Options Header
  → Risk: Clickjacking attacks possible
  → CVSS: 4.3 (Medium)
  → Fix: Add X-Frame-Options: DENY

[M-02] CSP Not Implemented
  → Risk: XSS escalation without mitigation
  → CVSS: 5.1 (Medium)
  → Fix: Implement Content-Security-Policy

[M-03] Unrestricted HTTP Methods
  → Risk: PUT/DELETE may expose data mutation
  → CVSS: 4.8 (Medium)
  → Fix: Restrict to GET/POST only

RECOMMENDATIONS: 3 items
Export: [PDF] [JSON] [Markdown]
```

**Voiceover:**  
*"One command generates a full red team report — formatted findings, CVSS scores, and remediation steps. Ready to paste into your audit submission."*

**Visual:** Report renders like a terminal output, then fades to a PDF-style layout briefly.

---

## SCENE 5 — Compare & GitHub Scan [0:45 – 0:55]

**Screen — Split demo, two quick commands:**

**Left panel:**
```
compare https://httpbin.org/v1 https://httpbin.org/v2

📊 Security Comparison
  v1 Risk Score: 65/100
  v2 Risk Score: 42/100
  Δ Improvement: -23 points ✅
  Fixed: 2 issues | New: 0 issues
```

**Right panel:**
```
scan-github https://github.com/example/defi-protocol

🔍 GitHub Security Scan
Repo: example/defi-protocol
Files scanned: 47 | Lines: 12,834

⚠️  CVE-2023-45136 pattern detected (reentrancy)
⚠️  Hardcoded API key in config.js (line 42)
✅  No known vulnerable dependencies
Risk: HIGH (2 critical findings)
```

**Voiceover:**  
*"Compare security before and after patches. Or scan entire GitHub repos for known CVE patterns and hardcoded secrets — automatically."*

**Visual:** Both panels visible side-by-side, highlights appear on key lines.

---

## SCENE 6 — Closing [0:55 – 1:00]

**Screen — Final card:**
```
┌──────────────────────────────────────────┐
│                                          │
│    🛡️  ShieldNet                         │
│                                          │
│    9 actions  •  26+ attack vectors      │
│    3 CVEs detected  •  AI-powered        │
│                                          │
│    Powered by:                           │
│    ⚡ Nosana  +  🤖 ElizaOS              │
│                                          │
│    github.com/[your-handle]/shieldnet    │
│                                          │
└──────────────────────────────────────────┘
```

**Voiceover:**  
*"ShieldNet. Nine security actions. Twenty-six attack vectors. Running on Nosana's decentralized GPU network, powered by ElizaOS. Security intelligence for the decentralized web."*

**Visual:** Stats count up one by one. Logo pulses. GitHub URL fades in last.

---

## Production Checklist

- [ ] Record terminal at 1080p
- [ ] Use slow typing speed for commands (human feel)
- [ ] Add subtle scan animation (spinner / progress bar)
- [ ] Export at 60fps minimum
- [ ] Add captions for accessibility
- [ ] Keep total runtime ≤ 62 seconds
- [ ] Upload to: YouTube (unlisted) + Twitter/X

## Screen Recording Setup

```bash
# Start ElizaOS locally for demo
cd shieldnet-agent
pnpm start

# Open browser to ElizaOS UI
open http://localhost:3000

# Or use terminal chat mode
# Use large font (18pt+) for readability
```

## Narration Timing (Quick Reference)

| Time | Action |
|------|--------|
| 0:00 | Title card appears |
| 0:05 | Problem stats animate in |
| 0:12 | "What if AI..." card |
| 0:15 | Type: scan https://httpbin.org |
| 0:18 | Results stream in |
| 0:30 | Risk meter animates |
| 0:35 | Type: redteam https://httpbin.org |
| 0:38 | Report renders |
| 0:45 | Compare command |
| 0:48 | GitHub scan |
| 0:55 | Closing card |
| 1:00 | End |
