/**
 * ShieldNet Security Plugin for ElizaOS v2
 * 
 * AI-powered cybersecurity agent that scans websites, analyzes code,
 * generates red team narratives, and produces executive security reports.
 * 
 * Actions:
 * - SCAN_URL: Scans websites for vulnerabilities via ShieldNet API
 * - ANALYZE_CODE: Reviews code for OWASP Top 10 security issues
 * - RED_TEAM: Generates attack narratives from scan results
 * - SECURITY_REPORT: Executive summary with grade A-F
 */

import {
  type Plugin,
  type Action,
  type IAgentRuntime,
  type Memory,
  type State,
  type HandlerCallback,
  type ActionExample,
  ModelType,
} from "@elizaos/core";

// ─── ShieldNet API Integration ────────────────────────────────────────────

const SHIELDNET_API = "https://scan.bughunt.tech";

interface ScanResult {
  target: string;
  score: number;
  grade: string;
  findings: Finding[];
  ssl?: Record<string, unknown>;
  headers?: Record<string, string>;
  ports?: PortResult[];
  dns?: Record<string, unknown>;
  duration?: number;
}

interface Finding {
  type: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  remediation?: string;
  details?: string;
}

interface PortResult {
  port: number;
  service: string;
  open: boolean;
}

// Store last scan results in memory for RED_TEAM and SECURITY_REPORT
const scanCache = new Map<string, ScanResult>();

async function scanUrl(target: string): Promise<ScanResult> {
  const url = `${SHIELDNET_API}/scan/url?target=${encodeURIComponent(target)}`;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { "User-Agent": "ShieldNet-ElizaOS/1.0" }
    });
    
    if (!response.ok) {
      throw new Error(`Scan API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json() as ScanResult;
    scanCache.set(target, data);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────

function extractUrl(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/i);
  return urlMatch ? urlMatch[0].replace(/[.,;:!?)]+$/, '') : null;
}

function extractCode(text: string): string | null {
  // Try to extract code from code blocks first
  const codeBlockMatch = text.match(/```[\s\S]*?\n([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  
  // Look for inline code patterns (function declarations, imports, etc.)
  const codePatterns = [
    /(?:function|const|let|var|import|export|class|def|public|private)\s+/,
    /(?:app\.|router\.|express|require|from\s+['"])/,
    /(?:SELECT|INSERT|UPDATE|DELETE)\s+/i,
    /<(?:script|form|input|iframe)/i,
  ];
  
  for (const pattern of codePatterns) {
    if (pattern.test(text)) {
      // Return everything after the first code-like line
      const lines = text.split('\n');
      const startIdx = lines.findIndex(l => pattern.test(l));
      if (startIdx >= 0) return lines.slice(startIdx).join('\n').trim();
    }
  }
  
  return null;
}

function formatFindings(findings: Finding[]): string {
  if (!findings || findings.length === 0) return "No vulnerabilities found. ✅";
  
  const grouped: Record<string, Finding[]> = {};
  for (const f of findings) {
    const sev = f.severity || "info";
    if (!grouped[sev]) grouped[sev] = [];
    grouped[sev].push(f);
  }
  
  const severityOrder = ["critical", "high", "medium", "low", "info"];
  const severityEmoji: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🔵",
    info: "⚪",
  };
  
  let output = "";
  for (const sev of severityOrder) {
    const items = grouped[sev];
    if (!items || items.length === 0) continue;
    output += `\n${severityEmoji[sev]} **${sev.toUpperCase()}** (${items.length})\n`;
    for (const f of items) {
      output += `  • ${f.title || f.type}`;
      if (f.description) output += ` — ${f.description}`;
      if (f.remediation) output += `\n    Fix: ${f.remediation}`;
      output += "\n";
    }
  }
  
  return output;
}

function calculateGrade(findings: Finding[]): { grade: string; score: number } {
  if (!findings || findings.length === 0) return { grade: "A", score: 100 };
  
  let score = 100;
  for (const f of findings) {
    switch (f.severity) {
      case "critical": score -= 25; break;
      case "high": score -= 15; break;
      case "medium": score -= 8; break;
      case "low": score -= 3; break;
      case "info": score -= 1; break;
    }
  }
  score = Math.max(0, score);
  
  let grade: string;
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";
  
  return { grade, score };
}

// ─── Action: SCAN_URL ─────────────────────────────────────────────────────

const scanUrlAction: Action = {
  name: "SCAN_URL",
  description: "Scan a website URL for security vulnerabilities including XSS, SQLi, SSRF, CORS misconfigurations, security headers, SSL/TLS issues, open ports, and DNS configuration. Use this when a user provides a URL and asks for a security scan or vulnerability assessment.",
  similes: [
    "SCAN_WEBSITE",
    "CHECK_SECURITY",
    "VULNERABILITY_SCAN",
    "SECURITY_SCAN",
    "PENTEST_URL",
    "CHECK_URL",
    "AUDIT_WEBSITE",
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    const hasUrl = /https?:\/\//i.test(text);
    const hasScanIntent = /scan|check|audit|test|vulnerab|secur|pentest|analyze|inspect/i.test(text);
    return hasUrl && hasScanIntent;
  },
  
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const text = message.content?.text || "";
    const target = extractUrl(text);
    
    if (!target) {
      if (callback) {
        await callback({
          text: "I couldn't find a valid URL in your message. Please provide a URL like `https://example.com` to scan.",
        });
      }
      return { success: false, error: "No URL found" };
    }
    
    // Notify user scan is starting
    if (callback) {
      await callback({
        text: `🛡️ **ShieldNet Scan Initiated**\nTarget: ${target}\nScanning for vulnerabilities across 26+ attack vectors...\nThis may take 30-60 seconds.`,
      });
    }
    
    try {
      const result = await scanUrl(target);
      
      const { grade, score } = result.grade 
        ? { grade: result.grade, score: result.score || 0 }
        : calculateGrade(result.findings || []);
      
      let report = `🛡️ **ShieldNet Scan Complete**\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `**Target:** ${target}\n`;
      report += `**Grade:** ${grade} (${score}/100)\n`;
      report += `**Findings:** ${(result.findings || []).length} total\n`;
      if (result.duration) report += `**Duration:** ${(result.duration / 1000).toFixed(1)}s\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += formatFindings(result.findings || []);
      report += `\n💡 Use "red team report" to see attack narratives or "security report" for an executive summary.`;
      
      if (callback) {
        await callback({ text: report });
      }
      
      return { success: true, data: { target, grade, score, findingsCount: (result.findings || []).length } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `⚠️ Scan failed for ${target}: ${errMsg}\n\nThis could be due to the target being unreachable, rate limiting, or network issues. Try again in a moment.`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
  
  examples: [
    [
      { name: "{{user1}}", content: { text: "Scan https://example.com for vulnerabilities" } },
      { name: "ShieldNet", content: { text: "🛡️ ShieldNet Scan Initiated\nTarget: https://example.com\nScanning for vulnerabilities across 26+ attack vectors..." } },
    ],
    [
      { name: "{{user1}}", content: { text: "Check the security of https://myapp.dev" } },
      { name: "ShieldNet", content: { text: "🛡️ ShieldNet Scan Initiated\nTarget: https://myapp.dev\nScanning for vulnerabilities..." } },
    ],
  ] as ActionExample[][],
};

// ─── Action: ANALYZE_CODE ─────────────────────────────────────────────────

const analyzeCodeAction: Action = {
  name: "ANALYZE_CODE",
  description: "Analyze source code for security vulnerabilities based on the OWASP Top 10. Reviews code for SQL injection, XSS, insecure deserialization, broken authentication, sensitive data exposure, and other common security flaws. Use this when a user shares code and asks for a security review.",
  similes: [
    "CODE_REVIEW",
    "REVIEW_CODE",
    "CODE_AUDIT",
    "CODE_SECURITY",
    "SECURITY_REVIEW",
    "CHECK_CODE",
    "AUDIT_CODE",
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "");
    const hasCode = extractCode(text) !== null;
    const hasReviewIntent = /review|analyze|check|audit|security|vulnerab|owasp|code/i.test(text.toLowerCase());
    return hasCode || (hasReviewIntent && text.includes('```'));
  },
  
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const text = message.content?.text || "";
    const code = extractCode(text);
    
    if (!code) {
      if (callback) {
        await callback({
          text: "I couldn't find code to analyze. Please share your code in a code block (```) or paste it directly.",
        });
      }
      return { success: false, error: "No code found" };
    }
    
    try {
      const prompt = `You are ShieldNet, an expert security code reviewer. Analyze the following code for security vulnerabilities.

Focus on OWASP Top 10:
1. A01: Broken Access Control
2. A02: Cryptographic Failures  
3. A03: Injection (SQLi, XSS, Command Injection, LDAP, etc.)
4. A04: Insecure Design
5. A05: Security Misconfiguration
6. A06: Vulnerable and Outdated Components
7. A07: Identification and Authentication Failures
8. A08: Software and Data Integrity Failures
9. A09: Security Logging and Monitoring Failures
10. A10: Server-Side Request Forgery (SSRF)

For each vulnerability found, provide:
- Severity (Critical/High/Medium/Low)
- OWASP category
- Description of the issue
- The vulnerable code snippet
- Fixed code example
- Impact if exploited

If the code is secure, acknowledge that and suggest hardening improvements.

Code to analyze:
\`\`\`
${code}
\`\`\`

Respond in a structured format with clear sections for each finding.`;

      const analysis = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        temperature: 0.3,
        maxTokens: 4096,
      });
      
      let response = `🔍 **ShieldNet Code Analysis**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      response += analysis;
      
      if (callback) {
        await callback({ text: response });
      }
      
      return { success: true, data: { codeLength: code.length } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `⚠️ Code analysis failed: ${errMsg}`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
  
  examples: [
    [
      { name: "{{user1}}", content: { text: "Review this code for security issues:\n```js\napp.get('/user', (req, res) => {\n  db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);\n});\n```" } },
      { name: "ShieldNet", content: { text: "🔍 ShieldNet Code Analysis\n\n🔴 CRITICAL: SQL Injection (A03)\nThe user input is directly concatenated into the SQL query..." } },
    ],
  ] as ActionExample[][],
};

// ─── Action: RED_TEAM ─────────────────────────────────────────────────────

const redTeamAction: Action = {
  name: "RED_TEAM",
  description: "Generate a red team attack narrative based on previously discovered vulnerabilities. Creates realistic attack scenarios showing how an attacker would chain vulnerabilities together to compromise the target. Use this after a URL scan has been performed.",
  similes: [
    "ATTACK_NARRATIVE",
    "RED_TEAM_REPORT",
    "ATTACK_SIMULATION",
    "THREAT_SCENARIO",
    "EXPLOIT_CHAIN",
    "ATTACK_CHAIN",
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /red\s*team|attack\s*(narrative|scenario|chain|simulation)|exploit\s*chain|threat\s*scenario/i.test(text);
  },
  
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback,
  ) => {
    // Get the most recent scan result
    const entries = Array.from(scanCache.entries());
    const lastScan = entries.length > 0 ? entries[entries.length - 1] : null;
    
    if (!lastScan) {
      if (callback) {
        await callback({
          text: "No previous scan results found. Please scan a URL first using `scan https://target.com` and then request a red team report.",
        });
      }
      return { success: false, error: "No scan data available" };
    }
    
    const [target, scanData] = lastScan;
    const findings = scanData.findings || [];
    
    if (findings.length === 0) {
      if (callback) {
        await callback({
          text: `✅ No vulnerabilities found in the last scan of ${target}. No attack narrative to generate — the target appears well-secured.`,
        });
      }
      return { success: true, data: { target, message: "No vulnerabilities to exploit" } };
    }
    
    try {
      const findingsJson = JSON.stringify(findings.slice(0, 20), null, 2);
      
      const prompt = `You are ShieldNet's Red Team module. Generate a realistic attack narrative based on these vulnerability scan results.

Target: ${target}
Scan Findings:
${findingsJson}

Create a red team report with:

1. **Executive Threat Summary** — One paragraph overview of the attack surface
2. **Attack Chains** — For each viable attack path:
   - Attack name (e.g., "Session Hijacking via XSS + Missing HSTS")
   - Step-by-step exploitation narrative (written as if an attacker is executing it)
   - Vulnerabilities chained together
   - Required skill level (Script Kiddie / Intermediate / Advanced / Expert)
   - Estimated time to exploit
   - Impact (what the attacker gains)
3. **Worst-Case Scenario** — The most damaging realistic attack combining multiple findings
4. **Risk Matrix** — Likelihood × Impact for top 3 attack chains
5. **Immediate Actions** — Top 3 things to fix RIGHT NOW

Be specific, technical, and realistic. Reference actual vulnerability details from the findings. Write attack narratives in present tense as if executing them.`;

      const narrative = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        temperature: 0.7,
        maxTokens: 4096,
      });
      
      let response = `🔴 **ShieldNet Red Team Report**\n`;
      response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      response += `**Target:** ${target}\n`;
      response += `**Findings Analyzed:** ${findings.length}\n`;
      response += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      response += narrative;
      
      if (callback) {
        await callback({ text: response });
      }
      
      return { success: true, data: { target, findingsCount: findings.length } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `⚠️ Red team report generation failed: ${errMsg}`,
        });
      }
      return { success: false, error: errMsg };
    }
  },
  
  examples: [
    [
      { name: "{{user1}}", content: { text: "Generate a red team report for the last scan" } },
      { name: "ShieldNet", content: { text: "🔴 ShieldNet Red Team Report\nTarget: https://example.com\n\nAttack Chain 1: Session Hijacking via XSS + Missing HSTS..." } },
    ],
  ] as ActionExample[][],
};

// ─── Action: SECURITY_REPORT ──────────────────────────────────────────────

const securityReportAction: Action = {
  name: "SECURITY_REPORT",
  description: "Generate an executive security summary with an overall grade (A-F), critical findings, business impact assessment, and prioritized remediation steps. Use this after a URL scan to get a board-ready security report.",
  similes: [
    "EXECUTIVE_SUMMARY",
    "SECURITY_SUMMARY",
    "SECURITY_GRADE",
    "GENERATE_REPORT",
    "FULL_REPORT",
    "ASSESSMENT_REPORT",
  ],
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /security\s*report|executive\s*summary|full\s*report|assessment|security\s*grade|generate\s*report/i.test(text);
  },
  
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const entries = Array.from(scanCache.entries());
    const lastScan = entries.length > 0 ? entries[entries.length - 1] : null;
    
    if (!lastScan) {
      if (callback) {
        await callback({
          text: "No previous scan results found. Please scan a URL first using `scan https://target.com` and then request a security report.",
        });
      }
      return { success: false, error: "No scan data available" };
    }
    
    const [target, scanData] = lastScan;
    const findings = scanData.findings || [];
    const { grade, score } = scanData.grade 
      ? { grade: scanData.grade, score: scanData.score || 0 }
      : calculateGrade(findings);
    
    const criticalCount = findings.filter(f => f.severity === "critical").length;
    const highCount = findings.filter(f => f.severity === "high").length;
    const mediumCount = findings.filter(f => f.severity === "medium").length;
    const lowCount = findings.filter(f => f.severity === "low").length;
    const infoCount = findings.filter(f => f.severity === "info").length;
    
    try {
      const findingsJson = JSON.stringify(findings.slice(0, 15), null, 2);
      
      const prompt = `You are ShieldNet generating an executive security report. Create a concise, actionable report.

Target: ${target}
Overall Grade: ${grade} (${score}/100)
Findings: ${criticalCount} Critical, ${highCount} High, ${mediumCount} Medium, ${lowCount} Low, ${infoCount} Info

Detailed Findings:
${findingsJson}

Generate a report with these sections:

1. **Overall Assessment** — 2-3 sentences about the security posture
2. **Business Impact** — What could happen if these issues aren't fixed (data breach cost, compliance risk, reputation damage)
3. **Top 3 Critical Findings** — The most dangerous issues with plain-English explanations a CEO can understand
4. **Remediation Priority** — Numbered list of what to fix first, with estimated effort (hours/days)
5. **Compliance Implications** — Impact on SOC2, PCI-DSS, GDPR if applicable
6. **Next Steps** — 3 concrete actions to take this week

Keep it concise. Use plain language. This is for executives, not engineers.`;

      const summary = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        temperature: 0.4,
        maxTokens: 3000,
      });
      
      const gradeEmoji: Record<string, string> = {
        A: "🟢", B: "🟢", C: "🟡", D: "🟠", F: "🔴"
      };
      
      let report = `📊 **ShieldNet Executive Security Report**\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `**Target:** ${target}\n`;
      report += `**Grade:** ${gradeEmoji[grade] || "⚪"} ${grade} (${score}/100)\n`;
      report += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
      report += `\n`;
      report += `**Findings Breakdown:**\n`;
      report += `🔴 Critical: ${criticalCount} | 🟠 High: ${highCount} | 🟡 Medium: ${mediumCount} | 🔵 Low: ${lowCount} | ⚪ Info: ${infoCount}\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      report += summary;
      report += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `🛡️ Report generated by ShieldNet • Hash Security\n`;
      report += `💡 Run "scan <url>" for a new scan or "red team report" for attack narratives.`;
      
      if (callback) {
        await callback({ text: report });
      }
      
      return { success: true, data: { target, grade, score, findings: findings.length } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      
      // Fallback: generate report without LLM
      let report = `📊 **ShieldNet Security Report**\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `**Target:** ${target}\n`;
      report += `**Grade:** ${grade} (${score}/100)\n`;
      report += `**Date:** ${new Date().toISOString().split('T')[0]}\n\n`;
      report += `**Findings:** ${criticalCount} Critical, ${highCount} High, ${mediumCount} Medium, ${lowCount} Low\n\n`;
      report += formatFindings(findings);
      report += `\n⚠️ Note: Executive summary generation failed (${errMsg}). Showing raw findings instead.`;
      
      if (callback) {
        await callback({ text: report });
      }
      
      return { success: true, data: { target, grade, score, fallback: true } };
    }
  },
  
  examples: [
    [
      { name: "{{user1}}", content: { text: "Give me a security report" } },
      { name: "ShieldNet", content: { text: "📊 ShieldNet Executive Security Report\nTarget: https://example.com\nGrade: 🟡 C (65/100)\n\nOverall Assessment: The target has several medium-severity issues..." } },
    ],
  ] as ActionExample[][],
};

// ─── Plugin Definition ────────────────────────────────────────────────────

const shieldNetPlugin: Plugin = {
  name: "shieldnet",
  description: "ShieldNet Security Plugin — AI-powered vulnerability scanning, code analysis, red teaming, and executive security reports. Built by Hash Security.",
  actions: [
    scanUrlAction,
    analyzeCodeAction,
    redTeamAction,
    securityReportAction,
  ],
  providers: [],
  evaluators: [],
};

export default shieldNetPlugin;
