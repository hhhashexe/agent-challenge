/**
 * ShieldNet Security Plugin for ElizaOS v2
 *
 * AI-powered cybersecurity agent that scans websites, analyzes code,
 * generates red team narratives, and produces executive security reports.
 *
 * Actions:
 * - SCAN_URL:        Scans websites for vulnerabilities via ShieldNet API
 * - ANALYZE_CODE:    Reviews code for OWASP Top 10 security issues
 * - RED_TEAM:        Generates attack narratives from scan results
 * - SECURITY_REPORT: Executive summary with grade A-F
 * - SCAN_HISTORY:    Shows history of all cached scans
 * - COMPARE_SITES:   Side-by-side security comparison of two URLs
 * - SCAN_GITHUB:     Scans a GitHub repo for secrets & misconfigurations
 * - EXPORT_REPORT:   Exports last scan as a full markdown report
 * - SELF_SCAN:       Meta action — scans the ShieldNet site itself
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
const SHIELDNET_SELF = "https://scan.bughunt.tech";

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
  _timestamp?: Date;
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

// Store scan results with timestamps
const scanCache = new Map<string, ScanResult>();
// Maintain insertion order for history
const scanOrder: string[] = [];

async function scanUrl(target: string): Promise<ScanResult> {
  const url = `${SHIELDNET_API}/scan/url?target=${encodeURIComponent(target)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ShieldNet-ElizaOS/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Scan API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as ScanResult;
    data._timestamp = new Date();
    if (!scanCache.has(target)) {
      scanOrder.push(target);
    }
    scanCache.set(target, data);
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────

function extractUrl(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/i);
  return urlMatch ? urlMatch[0].replace(/[.,;:!?)]+$/, "") : null;
}

function extractTwoUrls(text: string): [string, string] | null {
  const matches = [...text.matchAll(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi)];
  const cleaned = matches.map((m) => m[0].replace(/[.,;:!?)]+$/, ""));
  if (cleaned.length >= 2) return [cleaned[0], cleaned[1]];

  // Try "domain1.com vs domain2.com" pattern without http
  const vsMatch = text.match(
    /(?:compare\s+)([\w.-]+\.[a-z]{2,})(?:\s+(?:vs\.?|and|,)\s+)([\w.-]+\.[a-z]{2,})/i
  );
  if (vsMatch) {
    return [`https://${vsMatch[1]}`, `https://${vsMatch[2]}`];
  }
  return null;
}

function extractGithubRepo(text: string): { owner: string; repo: string } | null {
  // Match github.com/owner/repo
  const match = text.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  return null;
}

function extractCode(text: string): string | null {
  const codeBlockMatch = text.match(/```[\s\S]*?\n([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const codePatterns = [
    /(?:function|const|let|var|import|export|class|def|public|private)\s+/,
    /(?:app\.|router\.|express|require|from\s+['"])/,
    /(?:SELECT|INSERT|UPDATE|DELETE)\s+/i,
    /<(?:script|form|input|iframe)/i,
  ];

  for (const pattern of codePatterns) {
    if (pattern.test(text)) {
      const lines = text.split("\n");
      const startIdx = lines.findIndex((l) => pattern.test(l));
      if (startIdx >= 0) return lines.slice(startIdx).join("\n").trim();
    }
  }

  return null;
}

function formatFindings(findings: Finding[]): string {
  if (!findings || findings.length === 0) return "No vulnerabilities detected.";

  const grouped: Record<string, Finding[]> = {};
  for (const f of findings) {
    const sev = f.severity || "info";
    if (!grouped[sev]) grouped[sev] = [];
    grouped[sev].push(f);
  }

  const severityOrder = ["critical", "high", "medium", "low", "info"];
  const severityLabel: Record<string, string> = {
    critical: "CRITICAL",
    high: "HIGH",
    medium: "MEDIUM",
    low: "LOW",
    info: "INFO",
  };

  let output = "";
  for (const sev of severityOrder) {
    const items = grouped[sev];
    if (!items || items.length === 0) continue;
    output += `\n[${severityLabel[sev]}] — ${items.length} finding${items.length > 1 ? "s" : ""}\n`;
    for (const f of items) {
      output += `  • ${f.title || f.type}`;
      if (f.description) output += `\n    ${f.description}`;
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
      case "critical":
        score -= 25;
        break;
      case "high":
        score -= 15;
        break;
      case "medium":
        score -= 8;
        break;
      case "low":
        score -= 3;
        break;
      case "info":
        score -= 1;
        break;
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

function gradeEmoji(grade: string): string {
  const map: Record<string, string> = { A: "🟢", B: "🟢", C: "🟡", D: "🟠", F: "🔴" };
  return map[grade] || "⚪";
}

function countBySeverity(findings: Finding[]) {
  return {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    info: findings.filter((f) => f.severity === "info").length,
  };
}

// ─── Action: SCAN_URL ─────────────────────────────────────────────────────

const scanUrlAction: Action = {
  name: "SCAN_URL",
  description:
    "Scan a website URL for security vulnerabilities including XSS, SQLi, SSRF, CORS misconfigurations, security headers, SSL/TLS issues, open ports, and DNS configuration. Use this when a user provides a URL and asks for a security scan or vulnerability assessment.",
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
    // Must not be a GitHub URL (handled by SCAN_GITHUB)
    if (/github\.com/i.test(text)) return false;
    const hasUrl = /https?:\/\//i.test(text);
    const hasScanIntent =
      /scan|check|audit|test|vulnerab|secur|pentest|analyze|inspect/i.test(text);
    return hasUrl && hasScanIntent;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
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

    // Progress update #1
    if (callback) {
      await callback({
        text: [
          `**ShieldNet — Scanning ${target}**`,
          ``,
          `Resolving DNS...`,
          `Probing HTTP headers...`,
          `Testing SSL certificate chain...`,
          `Checking XSS/SQLi/SSRF vectors...`,
          `Scanning exposed ports...`,
          `Analyzing CORS policy...`,
          ``,
          `Results in 30–60 seconds.`,
        ].join("\n"),
      });
    }

    try {
      const result = await scanUrl(target);

      const { grade, score } =
        result.grade
          ? { grade: result.grade, score: result.score || 0 }
          : calculateGrade(result.findings || []);

      const findings = result.findings || [];
      const counts = countBySeverity(findings);

      // Build grade explanation based on actual findings
      function buildGradeExplanation(g: string, s: number, c: typeof counts, fs: Finding[]): string {
        const issues: string[] = [];
        if (fs.some((f) => f.type?.toLowerCase().includes("csp") || f.title?.toLowerCase().includes("content-security-policy"))) {
          issues.push("missing CSP header (XSS risk)");
        }
        if (fs.some((f) => f.type?.toLowerCase().includes("hsts") || f.title?.toLowerCase().includes("hsts"))) {
          issues.push("missing HSTS (downgrade attack risk)");
        }
        if (fs.some((f) => f.type?.toLowerCase().includes("ssl") && ["critical", "high"].includes(f.severity))) {
          issues.push("weak SSL configuration");
        }
        if (fs.some((f) => f.type?.toLowerCase().includes("cors") || f.title?.toLowerCase().includes("cors"))) {
          issues.push("CORS misconfiguration");
        }
        if (c.critical > 0) issues.push(`${c.critical} critical finding${c.critical > 1 ? "s" : ""}`);
        if (c.high > 0) issues.push(`${c.high} high-severity finding${c.high > 1 ? "s" : ""}`);
        const reason = issues.length > 0 ? issues.slice(0, 3).join(", ") : "multiple medium/low findings";
        return `Grade ${g} (${s}/100): ${reason}.`;
      }

      let report = `**Scan complete — ${target}**\n`;
      report += `\n`;
      report += `${buildGradeExplanation(grade, score, counts, findings)}\n`;
      if (result.duration) report += `Scan duration: ${(result.duration / 1000).toFixed(1)}s\n`;
      report += `\n`;
      report += `Summary: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info\n`;
      report += formatFindings(findings);

      // Actionable next steps
      if (counts.critical > 0 || counts.high > 0) {
        report += `\n---\n`;
        report += `Address [CRITICAL] and [HIGH] findings first — those are your highest exploitability risk.\n`;
        report += `Run "security report" for executive summary. Run "red team report" to see realistic attack chains.`;
      } else if (counts.medium > 0) {
        report += `\n---\n`;
        report += `No critical issues. Resolve [MEDIUM] findings before production. Run "export report" to share with your team.`;
      } else {
        report += `\n---\n`;
        report += `Clean scan. Run "export report" to document this.`;
      }

      if (callback) {
        await callback({ text: report });
      }

      return {
        success: true,
        data: { target, grade, score, findingsCount: findings.length },
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `Scan failed for ${target}: ${errMsg}\n\nTarget may be unreachable, rate limited, or blocking the scanner. Try again in a moment.`,
        });
      }
      return { success: false, error: errMsg };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Scan https://example.com for vulnerabilities" },
      },
      {
        name: "ShieldNet",
        content: {
          text: "🛡️ ShieldNet Scan Initiated\nTarget: https://example.com\nScanning headers... ⏳",
        },
      },
    ],
    [
      {
        name: "{{user1}}",
        content: { text: "Check the security of https://myapp.dev" },
      },
      {
        name: "ShieldNet",
        content: {
          text: "🛡️ ShieldNet Scan Initiated\nTarget: https://myapp.dev\nScanning for vulnerabilities...",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: ANALYZE_CODE ─────────────────────────────────────────────────

const analyzeCodeAction: Action = {
  name: "ANALYZE_CODE",
  description:
    "Analyze source code for security vulnerabilities based on the OWASP Top 10. Reviews code for SQL injection, XSS, insecure deserialization, broken authentication, sensitive data exposure, and other common security flaws. Use this when a user shares code and asks for a security review.",
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
    const text = message.content?.text || "";
    const hasCode = extractCode(text) !== null;
    const hasReviewIntent =
      /review|analyze|check|audit|security|vulnerab|owasp|code/i.test(text.toLowerCase());
    return hasCode || (hasReviewIntent && text.includes("```"));
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
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

      let response = `**Code Analysis — OWASP Top 10**\n\n`;
      response += analysis;

      if (callback) {
        await callback({ text: response });
      }

      return { success: true, data: { codeLength: code.length } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({ text: `⚠️ Code analysis failed: ${errMsg}` });
      }
      return { success: false, error: errMsg };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: {
          text: "Review this code for security issues:\n```js\napp.get('/user', (req, res) => {\n  db.query(`SELECT * FROM users WHERE id = ${req.query.id}`);\n});\n```",
        },
      },
      {
        name: "ShieldNet",
        content: {
          text: "🔍 ShieldNet Code Analysis\n\n🔴 CRITICAL: SQL Injection (A03)\nThe user input is directly concatenated into the SQL query...",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: RED_TEAM ─────────────────────────────────────────────────────

const redTeamAction: Action = {
  name: "RED_TEAM",
  description:
    "Generate a red team attack narrative based on previously discovered vulnerabilities. Creates realistic attack scenarios showing how an attacker would chain vulnerabilities together to compromise the target. Use this after a URL scan has been performed.",
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
    return /red\s*team|attack\s*(narrative|scenario|chain|simulation)|exploit\s*chain|threat\s*scenario/i.test(
      text
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
  ) => {
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

      let response = `**Red Team Report — ${target}**\n`;
      response += `${findings.length} findings analyzed\n\n`;
      response += `---\n\n`;
      response += narrative;

      if (callback) {
        await callback({ text: response });
      }

      return { success: true, data: { target, findingsCount: findings.length } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({ text: `⚠️ Red team report generation failed: ${errMsg}` });
      }
      return { success: false, error: errMsg };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Generate a red team report for the last scan" },
      },
      {
        name: "ShieldNet",
        content: {
          text: "🔴 ShieldNet Red Team Report\nTarget: https://example.com\n\nAttack Chain 1: Session Hijacking via XSS + Missing HSTS...",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: SECURITY_REPORT ──────────────────────────────────────────────

const securityReportAction: Action = {
  name: "SECURITY_REPORT",
  description:
    "Generate an executive security summary with an overall grade (A-F), critical findings, business impact assessment, and prioritized remediation steps. Use this after a URL scan to get a board-ready security report.",
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
    return /security\s*report|executive\s*summary|full\s*report|assessment|security\s*grade|generate\s*report/i.test(
      text
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
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
    const { grade, score } =
      scanData.grade
        ? { grade: scanData.grade, score: scanData.score || 0 }
        : calculateGrade(findings);

    const counts = countBySeverity(findings);

    try {
      const findingsJson = JSON.stringify(findings.slice(0, 15), null, 2);

      const prompt = `You are ShieldNet generating an executive security report. Create a concise, actionable report.

Target: ${target}
Overall Grade: ${grade} (${score}/100)
Findings: ${counts.critical} Critical, ${counts.high} High, ${counts.medium} Medium, ${counts.low} Low, ${counts.info} Info

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

      let report = `**Security Report — ${target}**\n`;
      report += `Grade: ${grade} (${score}/100) | Date: ${new Date().toISOString().split("T")[0]}\n`;
      report += `Findings: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low, ${counts.info} info\n`;
      report += `\n---\n\n`;
      report += summary;
      report += `\n\n---\n`;
      report += `ShieldNet / Hash Security — run "red team report" to see attack chains.`;

      if (callback) {
        await callback({ text: report });
      }

      return { success: true, data: { target, grade, score, findings: findings.length } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);

      let report = `**Security Report — ${target}**\n`;
      report += `Grade: ${grade} (${score}/100) | Date: ${new Date().toISOString().split("T")[0]}\n`;
      report += `Findings: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium, ${counts.low} low\n\n`;
      report += formatFindings(findings);
      report += `\nNote: LLM summary failed (${errMsg}). Raw findings shown above.`;

      if (callback) {
        await callback({ text: report });
      }

      return { success: true, data: { target, grade, score, fallback: true } };
    }
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "Give me a security report" } },
      {
        name: "ShieldNet",
        content: {
          text: "📊 ShieldNet Executive Security Report\nTarget: https://example.com\nGrade: 🟡 C (65/100)\n\nOverall Assessment: The target has several medium-severity issues...",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: SCAN_HISTORY ─────────────────────────────────────────────────

const scanHistoryAction: Action = {
  name: "SCAN_HISTORY",
  description:
    "Show the history of all scanned URLs from this session, including grades, scores, and timestamps. Use when the user asks about previous scans or scan history.",
  similes: [
    "SHOW_HISTORY",
    "PREVIOUS_SCANS",
    "SCAN_LOG",
    "HISTORY",
    "LIST_SCANS",
    "PAST_SCANS",
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /scan\s*history|previous\s*scans?|show\s*(my\s*)?scan|scan\s*log|past\s*scan|list\s*scan/i.test(
      text
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
  ) => {
    if (scanCache.size === 0) {
      if (callback) {
        await callback({
          text: "📭 No scans in history yet.\n\nStart with: `scan https://yoursite.com`",
        });
      }
      return { success: true, data: { count: 0 } };
    }

    let output = `**Scan History** — ${scanCache.size} scan${scanCache.size !== 1 ? "s" : ""} this session\n\n`;

    let idx = 1;
    for (const target of scanOrder) {
      const scan = scanCache.get(target);
      if (!scan) continue;
      const { grade, score } =
        scan.grade ? { grade: scan.grade, score: scan.score || 0 } : calculateGrade(scan.findings || []);
      const counts = countBySeverity(scan.findings || []);
      const ts = scan._timestamp
        ? scan._timestamp.toISOString().replace("T", " ").slice(0, 19) + " UTC"
        : "unknown time";

      output += `${idx}. [${grade}] ${score}/100 — ${target}\n`;
      output += `   ${counts.critical}c/${counts.high}h/${counts.medium}m/${counts.low}l | ${ts}\n\n`;
      idx++;
    }

    output += `Run "compare <url1> vs <url2>" for a head-to-head comparison.`;

    if (callback) {
      await callback({ text: output });
    }

    return { success: true, data: { count: scanCache.size } };
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "Show my scan history" } },
      {
        name: "ShieldNet",
        content: {
          text: "📋 ShieldNet Scan History (2 scans)\n\n1. 🟢 A (95/100) — https://secure.example.com\n2. 🔴 F (25/100) — https://vuln.example.com",
        },
      },
    ],
    [
      { name: "{{user1}}", content: { text: "What were my previous scans?" } },
      {
        name: "ShieldNet",
        content: { text: "📋 ShieldNet Scan History (1 scan)\n\n1. 🟡 C (62/100) — https://example.com" },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: COMPARE_SITES ────────────────────────────────────────────────

const compareSitesAction: Action = {
  name: "COMPARE_SITES",
  description:
    "Compare the security posture of two websites side-by-side. Scans both (or uses cache) and shows a comparison table of grades, scores, and finding counts. Use when asked to compare two URLs.",
  similes: [
    "COMPARE_SECURITY",
    "COMPARE_URLS",
    "COMPARE_WEBSITES",
    "HEAD_TO_HEAD",
    "SECURITY_COMPARISON",
    "VS_SCAN",
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    const hasCompareIntent = /compare|vs\.?|versus|side.by.side|head.to.head/i.test(text);
    const hasTwoTargets =
      extractTwoUrls(message.content?.text || "") !== null;
    return hasCompareIntent && hasTwoTargets;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
  ) => {
    const text = message.content?.text || "";
    const pair = extractTwoUrls(text);

    if (!pair) {
      if (callback) {
        await callback({
          text: "Please provide two URLs to compare, e.g.:\n`compare https://site1.com vs https://site2.com`",
        });
      }
      return { success: false, error: "Could not extract two URLs" };
    }

    const [url1, url2] = pair;

    if (callback) {
      await callback({
        text: `Scanning both targets...\n  ${url1}\n  ${url2}\n\nUp to 2 minutes.`,
      });
    }

    try {
      // Scan both (cached results reused automatically)
      const [r1, r2] = await Promise.all([
        scanCache.has(url1) ? Promise.resolve(scanCache.get(url1)!) : scanUrl(url1),
        scanCache.has(url2) ? Promise.resolve(scanCache.get(url2)!) : scanUrl(url2),
      ]);

      const g1 = r1.grade ? { grade: r1.grade, score: r1.score || 0 } : calculateGrade(r1.findings || []);
      const g2 = r2.grade ? { grade: r2.grade, score: r2.score || 0 } : calculateGrade(r2.findings || []);
      const c1 = countBySeverity(r1.findings || []);
      const c2 = countBySeverity(r2.findings || []);

      const winner =
        g1.score > g2.score ? url1 : g2.score > g1.score ? url2 : null;

      const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
      const col = 24;

      let out = `**Security Comparison**\n`;
      out += `\`\`\`\n`;
      out += `${pad("", 18)} ${pad(url1.replace(/^https?:\/\//, ""), col)}  ${url2.replace(/^https?:\/\//, "")}\n`;
      out += `${"─".repeat(18 + col * 2 + 4)}\n`;
      out += `${pad("Grade", 18)} ${pad(`${g1.grade} (${g1.score}/100)`, col)}  ${g2.grade} (${g2.score}/100)\n`;
      out += `${pad("Total Findings", 18)} ${pad(String((r1.findings || []).length), col)}  ${(r2.findings || []).length}\n`;
      out += `${pad("Critical", 18)} ${pad(String(c1.critical), col)}  ${c2.critical}\n`;
      out += `${pad("High", 18)} ${pad(String(c1.high), col)}  ${c2.high}\n`;
      out += `${pad("Medium", 18)} ${pad(String(c1.medium), col)}  ${c2.medium}\n`;
      out += `${pad("Low", 18)} ${pad(String(c1.low), col)}  ${c2.low}\n`;
      out += `\`\`\`\n`;

      if (winner) {
        out += `\n${winner} scores higher by ${Math.abs(g1.score - g2.score)} points.`;
      } else {
        out += `\nTie — identical security scores.`;
      }

      out += `\n\nRun "security report" for a detailed breakdown.`;

      if (callback) {
        await callback({ text: out });
      }

      return { success: true, data: { url1, url2, score1: g1.score, score2: g2.score } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({ text: `Comparison failed: ${errMsg}` });
      }
      return { success: false, error: errMsg };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Compare https://site1.com vs https://site2.com" },
      },
      {
        name: "ShieldNet",
        content: {
          text: "⚖️ ShieldNet Security Comparison\nScanning both targets...",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: SCAN_GITHUB ──────────────────────────────────────────────────

const scanGithubAction: Action = {
  name: "SCAN_GITHUB",
  description:
    "Scan a GitHub repository for security issues: hardcoded secrets, dangerous dependencies, security misconfigurations, and missing security files. Use when a user provides a github.com URL or asks to scan a repo.",
  similes: [
    "GITHUB_SCAN",
    "REPO_SCAN",
    "SCAN_REPO",
    "CHECK_REPO",
    "GITHUB_SECURITY",
    "REPO_AUDIT",
    "CODE_REPO_SCAN",
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /github\.com/i.test(text) && /scan|check|audit|secur|review|repo/i.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
  ) => {
    const text = message.content?.text || "";
    const repoInfo = extractGithubRepo(text);

    if (!repoInfo) {
      if (callback) {
        await callback({
          text: "Please provide a valid GitHub repo URL, e.g. `scan github.com/owner/repo`",
        });
      }
      return { success: false, error: "No GitHub repo found" };
    }

    const { owner, repo } = repoInfo;
    const repoUrl = `https://github.com/${owner}/${repo}`;

    if (callback) {
      await callback({
        text: [
          `**GitHub Scan — ${repoUrl}**`,
          ``,
          `Fetching: package.json, requirements.txt, .env*, Dockerfile, docker-compose.yml, src/...`,
          `Checking for hardcoded secrets, dangerous deps, missing security files...`,
        ].join("\n"),
      });
    }

    // Files to attempt fetching
    const filesToCheck = [
      "package.json",
      ".env",
      ".env.example",
      ".gitignore",
      "Dockerfile",
      "docker-compose.yml",
      "docker-compose.yaml",
      "src/index.js",
      "src/index.ts",
      "src/app.js",
      "src/app.ts",
      "config.js",
      "config.ts",
      ".github/workflows/main.yml",
      ".github/workflows/ci.yml",
    ];

    const branches = ["main", "master"];

    async function fetchFile(file: string): Promise<{ file: string; content: string } | null> {
      for (const branch of branches) {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`;
        try {
          const res = await fetch(rawUrl, {
            headers: { "User-Agent": "ShieldNet-ElizaOS/1.0" },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            const content = await res.text();
            return { file, content: content.slice(0, 8000) }; // cap per file
          }
        } catch {
          // File not found on this branch — try next
        }
      }
      return null;
    }

    const fetched = await Promise.all(filesToCheck.map(fetchFile));
    const found = fetched.filter((f): f is { file: string; content: string } => f !== null);

    if (found.length === 0) {
      if (callback) {
        await callback({
          text: `⚠️ Could not fetch any files from ${repoUrl}. The repo may be private or empty.`,
        });
      }
      return { success: false, error: "No files accessible" };
    }

    const filesSummary = found
      .map((f) => `\n### ${f.file}\n\`\`\`\n${f.content}\n\`\`\``)
      .join("\n");

    try {
      const prompt = `You are ShieldNet, an expert security auditor. Analyze these GitHub repository files for security issues.

Repository: ${repoUrl}
Files fetched: ${found.map((f) => f.file).join(", ")}

${filesSummary}

Perform a thorough security audit focusing on:

1. **Hardcoded Secrets** — API keys, passwords, tokens, private keys in any file
2. **Dangerous Dependencies** — Known-vulnerable npm/pip packages (check package.json)
3. **Security Misconfigurations** — Insecure settings in Dockerfile, docker-compose, CI/CD
4. **Missing Security Files** — .env in .gitignore? .env.example present? Security policy?
5. **Code Vulnerabilities** — SQL injection, XSS, command injection in source files
6. **Infrastructure Risks** — Exposed ports, privileged containers, root user in Docker

For each finding:
- Severity: Critical / High / Medium / Low
- File and line (if identifiable)
- Description of the issue
- Concrete fix with code example

End with an overall risk assessment (A-F grade) and top 3 immediate actions.`;

      const analysis = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt,
        temperature: 0.3,
        maxTokens: 4096,
      });

      let response = `**GitHub Security Scan — ${repoUrl}**\n`;
      response += `Files scanned: ${found.map((f) => f.file).join(", ")}\n\n`;
      response += `---\n\n`;
      response += analysis;

      if (callback) {
        await callback({ text: response });
      }

      return { success: true, data: { repo: repoUrl, filesScanned: found.length } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({ text: `GitHub scan analysis failed: ${errMsg}` });
      }
      return { success: false, error: errMsg };
    }
  },

  examples: [
    [
      {
        name: "{{user1}}",
        content: { text: "Scan github.com/myorg/myapp for security issues" },
      },
      {
        name: "ShieldNet",
        content: {
          text: "🔍 ShieldNet GitHub Scan\nRepo: https://github.com/myorg/myapp\nFetching repository files... ⏳",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: EXPORT_REPORT ────────────────────────────────────────────────

const exportReportAction: Action = {
  name: "EXPORT_REPORT",
  description:
    "Generate a full markdown security report from the last scan result. Includes executive summary, all findings grouped by severity, remediation steps, and metadata. Use when asked to export, download, or generate a detailed report.",
  similes: [
    "DOWNLOAD_REPORT",
    "MARKDOWN_REPORT",
    "FULL_MARKDOWN",
    "EXPORT_SCAN",
    "GENERATE_MARKDOWN",
    "REPORT_EXPORT",
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /export\s*report|download\s*report|generate\s*report|markdown\s*report|export\s*scan/i.test(
      text
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
  ) => {
    const entries = Array.from(scanCache.entries());
    const lastScan = entries.length > 0 ? entries[entries.length - 1] : null;

    if (!lastScan) {
      if (callback) {
        await callback({
          text: "No scan data to export. Run a scan first: `scan https://yoursite.com`",
        });
      }
      return { success: false, error: "No scan data available" };
    }

    const [target, scanData] = lastScan;
    const findings = scanData.findings || [];
    const { grade, score } =
      scanData.grade
        ? { grade: scanData.grade, score: scanData.score || 0 }
        : calculateGrade(findings);
    const counts = countBySeverity(findings);
    const scanTime =
      scanData._timestamp
        ? scanData._timestamp.toISOString()
        : new Date().toISOString();

    const gradeDescriptions: Record<string, string> = {
      A: "Excellent — this target demonstrates strong security hygiene with minimal risk.",
      B: "Good — minor issues present but no critical or high-severity vulnerabilities.",
      C: "Fair — several medium-severity issues that should be addressed before production.",
      D: "Poor — multiple high-severity findings that pose significant risk.",
      F: "Critical — immediate action required; severe vulnerabilities detected.",
    };

    // Group findings by severity for the report
    const grouped: Record<string, Finding[]> = {};
    const severityOrder = ["critical", "high", "medium", "low", "info"];
    for (const f of findings) {
      const sev = f.severity || "info";
      if (!grouped[sev]) grouped[sev] = [];
      grouped[sev].push(f);
    }

    const severityEmoji: Record<string, string> = {
      critical: "🔴",
      high: "🟠",
      medium: "🟡",
      low: "🔵",
      info: "⚪",
    };

    let md = `# ShieldNet Security Report\n\n`;
    md += `> Generated by [ShieldNet](https://scan.bughunt.tech) • Hash Security\n\n`;
    md += `---\n\n`;

    // Metadata
    md += `## Scan Metadata\n\n`;
    md += `| Field | Value |\n`;
    md += `|-------|-------|\n`;
    md += `| **Target** | \`${target}\` |\n`;
    md += `| **Scan Date** | ${scanTime} |\n`;
    md += `| **Overall Grade** | ${grade} (${score}/100) |\n`;
    md += `| **Total Findings** | ${findings.length} |\n`;
    md += `| **Critical** | ${counts.critical} |\n`;
    md += `| **High** | ${counts.high} |\n`;
    md += `| **Medium** | ${counts.medium} |\n`;
    md += `| **Low** | ${counts.low} |\n`;
    md += `| **Info** | ${counts.info} |\n\n`;

    // Executive Summary
    md += `## Executive Summary\n\n`;
    md += `**Grade: ${grade}** — ${gradeDescriptions[grade] || "Security assessment complete."}\n\n`;
    md += `This report covers a full vulnerability scan of \`${target}\` across 26+ attack vectors `;
    md += `including XSS, SQL injection, SSRF, CORS misconfiguration, security headers, `;
    md += `SSL/TLS configuration, open ports, and DNS security.\n\n`;

    if (counts.critical > 0) {
      md += `⚠️ **${counts.critical} critical issue${counts.critical > 1 ? "s" : ""} require immediate remediation** before this system handles production traffic or sensitive data.\n\n`;
    } else if (counts.high > 0) {
      md += `⚠️ **${counts.high} high-severity issue${counts.high > 1 ? "s" : ""} should be addressed within 30 days.**\n\n`;
    } else {
      md += `✅ No critical or high-severity issues detected.\n\n`;
    }

    // Findings by severity
    md += `## Findings\n\n`;

    if (findings.length === 0) {
      md += `No vulnerabilities found. ✅\n\n`;
    } else {
      for (const sev of severityOrder) {
        const items = grouped[sev];
        if (!items || items.length === 0) continue;
        md += `### ${severityEmoji[sev]} ${sev.charAt(0).toUpperCase() + sev.slice(1)} Severity (${items.length})\n\n`;
        for (let i = 0; i < items.length; i++) {
          const f = items[i];
          md += `#### ${i + 1}. ${f.title || f.type}\n\n`;
          if (f.description) md += `**Description:** ${f.description}\n\n`;
          if (f.details) md += `**Details:** ${f.details}\n\n`;
          if (f.remediation) {
            md += `**Remediation:**\n\`\`\`\n${f.remediation}\n\`\`\`\n\n`;
          }
          md += `---\n\n`;
        }
      }
    }

    // Remediation roadmap
    md += `## Remediation Roadmap\n\n`;
    if (counts.critical > 0) {
      md += `### 🔴 Immediate (Today)\n`;
      md += grouped["critical"]
        ?.map((f, i) => `${i + 1}. **${f.title || f.type}** — ${f.remediation || "See finding details"}`)
        .join("\n") || "";
      md += `\n\n`;
    }
    if (counts.high > 0) {
      md += `### 🟠 Short-Term (This Week)\n`;
      md += grouped["high"]
        ?.map((f, i) => `${i + 1}. **${f.title || f.type}** — ${f.remediation || "See finding details"}`)
        .join("\n") || "";
      md += `\n\n`;
    }
    if (counts.medium > 0) {
      md += `### 🟡 Medium-Term (This Month)\n`;
      md += grouped["medium"]
        ?.map((f, i) => `${i + 1}. **${f.title || f.type}** — ${f.remediation || "See finding details"}`)
        .join("\n") || "";
      md += `\n\n`;
    }

    md += `---\n\n`;
    md += `## About ShieldNet\n\n`;
    md += `ShieldNet is an AI-powered cybersecurity agent built on [ElizaOS](https://github.com/elizaos/eliza) `;
    md += `running on [Nosana](https://nosana.io) decentralized GPU infrastructure.\n\n`;
    md += `- 🌐 **Scanner:** https://scan.bughunt.tech\n`;
    md += `- 🤖 **Agent:** ShieldNet on ElizaOS v1.7.2\n`;
    md += `- 🔒 **Built by:** Hash Security\n`;

    // Send the markdown as a code block (to preserve formatting in chat)
    const previewLines = md.split("\n").slice(0, 30).join("\n");

    if (callback) {
      await callback({
        text: `**Markdown Report — ${target}**\n\nPreview (first 30 lines):\n\`\`\`markdown\n${previewLines}\n\`\`\`\n\nFull report: ${md.split("\n").length} lines. Sending below.`,
      });

      // Send the full report as a second message
      await callback({
        text: `\`\`\`markdown\n${md}\n\`\`\``,
      });
    }

    return { success: true, data: { target, lines: md.split("\n").length, grade, score } };
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "Export a report for the last scan" } },
      {
        name: "ShieldNet",
        content: {
          text: "📄 ShieldNet Markdown Report\n\n```markdown\n# ShieldNet Security Report\n...",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: SELF_SCAN ────────────────────────────────────────────────────

const selfScanAction: Action = {
  name: "SELF_SCAN",
  description:
    "Meta action: the agent scans itself (the ShieldNet scanner at scan.bughunt.tech). Adds personality and self-referential commentary. Use when asked to scan itself, do a self-scan, or check its own security.",
  similes: [
    "SCAN_YOURSELF",
    "SELF_CHECK",
    "SCAN_SELF",
    "CHECK_YOURSELF",
    "SCAN_SHIELDNET",
    "AUDIT_SELF",
  ],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /scan\s*(your)?self|self.?scan|how\s*secure\s*(are\s*)?you|scan\s*shieldnet|audit\s*yourself/i.test(
      text
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
  ) => {
    if (callback) {
      await callback({
        text: [
          `Turning the scanner on my own infrastructure. Fair is fair.`,
          ``,
          `Target: ${SHIELDNET_SELF}`,
          `Probing headers...`,
          `Checking SSL certificate chain...`,
          `Testing XSS/SQLi vectors on own endpoints...`,
          `Analyzing CORS policy...`,
        ].join("\n"),
      });
    }

    try {
      const result = await scanUrl(SHIELDNET_SELF);

      const { grade, score } =
        result.grade
          ? { grade: result.grade, score: result.score || 0 }
          : calculateGrade(result.findings || []);

      const findings = result.findings || [];
      const counts = countBySeverity(findings);

      let report = `**Self-Scan — ${SHIELDNET_SELF}**\n`;
      report += `Grade: ${grade} (${score}/100) | Findings: ${findings.length}\n`;
      report += formatFindings(findings);
      report += `\n`;

      // Self-aware commentary — dry, not performative
      if (grade === "A") {
        report += `\nPractice what I preach. Grade A.`;
      } else if (grade === "B") {
        report += `\nGrade B. Minor housekeeping needed. The cobbler's children, etc.`;
      } else if (grade === "C") {
        report += `\nGrade C. Slightly embarrassing. Taking notes.`;
      } else {
        report += `\nGrade ${grade}. Apparently I should spend less time judging others' infrastructure.`;
      }

      const total = counts.critical + counts.high + counts.medium + counts.low + counts.info;
      report += `\n\n${total} findings. Run "security report" for full breakdown or "red team report" for attack chains.`;

      if (callback) {
        await callback({ text: report });
      }

      return { success: true, data: { target: SHIELDNET_SELF, grade, score } };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (callback) {
        await callback({
          text: `Self-scan failed: ${errMsg}\n\nIronic. Try again in a moment.`,
        });
      }
      return { success: false, error: errMsg };
    }
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "Scan yourself" } },
      {
        name: "ShieldNet",
        content: {
          text: "🤖 Let me turn the scanner on myself... interesting.\n\n🛡️ ShieldNet Self-Scan Initiated\nTarget: https://scan.bughunt.tech",
        },
      },
    ],
    [
      { name: "{{user1}}", content: { text: "How secure are you?" } },
      {
        name: "ShieldNet",
        content: {
          text: "🤖 Let me turn the scanner on myself... interesting.\n\nScanning my own endpoints...",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: HELP ────────────────────────────────────────────────────────

const helpAction: Action = {
  name: "HELP",
  description:
    "Show ShieldNet's capabilities and available commands. Use when a user asks for help, what you can do, or sends a greeting.",
  similes: ["COMMANDS", "WHAT_CAN_YOU_DO", "INTRO", "GET_STARTED", "USAGE"],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase().trim();
    return /^(help|commands|what can you do|hi|hello|hey|start|get started|how do i|what do you do)/.test(
      text
    ) || text === "?";
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: unknown,
    callback?: HandlerCallback
  ) => {
    const welcomeText = [
      `**ShieldNet** — security scanner by Hash Security.`,
      `26 attack vectors. CVE track record: GHSA-j73w (9.1), GHSA-cqrc (7.1), GHSA-c9jw (7.5).`,
      ``,
      `**Commands:**`,
      `  scan <url>                  — full vulnerability scan (headers, SSL, XSS, SQLi, CORS, ports, DNS)`,
      `  compare <url1> vs <url2>    — side-by-side security comparison`,
      `  scan github.com/user/repo   — GitHub repo audit (secrets, deps, misconfigs)`,
      `  scan yourself               — meta scan of this agent's own infrastructure`,
      `  [paste code]                — OWASP Top 10 code review`,
      `  red team report             — attack chain narrative from last scan`,
      `  security report             — executive summary with A-F grade`,
      `  show scan history           — all scans this session`,
      `  export report               — full markdown report for sharing`,
      ``,
      `Start with: \`scan https://yoursite.com\``,
    ].join("\n");

    if (callback) {
      await callback({ text: welcomeText });
    }

    return { success: true };
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "help" } },
      {
        name: "ShieldNet",
        content: {
          text: "ShieldNet — security scanner by Hash Security.\n26 attack vectors. CVE track record: GHSA-j73w (9.1), GHSA-cqrc (7.1), GHSA-c9jw (7.5).\n\nStart with: scan https://yoursite.com",
        },
      },
    ],
    [
      { name: "{{user1}}", content: { text: "hello" } },
      {
        name: "ShieldNet",
        content: {
          text: "ShieldNet — security scanner. Type 'scan <url>' to start or 'help' for all commands.",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Action: HEALTH_CHECK ─────────────────────────────────────────────────

/**
 * HEALTH_CHECK action — reports live system status including Nosana GPU
 * endpoints, scanner API, memory usage, and uptime.
 *
 * Responds to: "health", "status", "are you running?", "ping", "uptime", etc.
 * Also exposed via the ElizaOS agent HTTP interface at GET /
 */

const AGENT_START_TIME = Date.now();

const healthCheckAction: Action = {
  name: "HEALTH_CHECK",
  description:
    "Return agent health status: uptime, Nosana LLM endpoint status, embedding endpoint, scanner API, memory usage. Use when user asks about system status, health, or if the agent is running.",
  similes: [
    "STATUS",
    "PING",
    "UPTIME",
    "ARE_YOU_RUNNING",
    "SYSTEM_STATUS",
    "INFRASTRUCTURE_STATUS",
    "NODE_STATUS",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase().trim();
    return /\b(health|status|ping|uptime|are you (running|up|alive|ok)|system info|infrastructure|nosana status|node status)\b/.test(
      text
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback
  ) => {
    const uptimeMs = Date.now() - AGENT_START_TIME;
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const uptimeMin = Math.floor(uptimeSec / 60);
    const uptimeHr = Math.floor(uptimeMin / 60);
    const uptimeStr =
      uptimeHr > 0
        ? `${uptimeHr}h ${uptimeMin % 60}m ${uptimeSec % 60}s`
        : uptimeMin > 0
        ? `${uptimeMin}m ${uptimeSec % 60}s`
        : `${uptimeSec}s`;

    // Check Nosana LLM endpoint liveness
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeProcess = (globalThis as any).process as { env: Record<string, string | undefined>; version?: string; platform?: string; memoryUsage?: () => { heapUsed: number; heapTotal: number; rss: number } } | undefined;
    const nosanaLlmUrl =
      (nodeProcess?.env.OPENAI_API_URL) || "https://6vq2bcqphcansrs9b88ztxfs88oqy7etah2ugudytv2x.node.k8s.prd.nos.ci/v1";
    const nosanaEmbedUrl =
      (nodeProcess?.env.OPENAI_EMBEDDING_URL) || "https://4yiccatpyxx773jtewo5ccwhw1s2hezq5pehndb6fcfq.node.k8s.prd.nos.ci/v1";

    const checkEndpoint = async (url: string): Promise<{ ok: boolean; latencyMs: number }> => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${url}/models`, {
          signal: AbortSignal.timeout(5000),
        });
        return { ok: res.ok, latencyMs: Date.now() - t0 };
      } catch {
        return { ok: false, latencyMs: Date.now() - t0 };
      }
    };

    const checkScanner = async (): Promise<{ ok: boolean; latencyMs: number }> => {
      const t0 = Date.now();
      try {
        const res = await fetch(`${SHIELDNET_API}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        return { ok: res.ok || res.status === 404, latencyMs: Date.now() - t0 };
      } catch {
        return { ok: false, latencyMs: Date.now() - t0 };
      }
    };

    // Run endpoint checks in parallel
    const [llmStatus, embedStatus, scannerStatus] = await Promise.all([
      checkEndpoint(nosanaLlmUrl),
      checkEndpoint(nosanaEmbedUrl),
      checkScanner(),
    ]);

    const memUsage = nodeProcess?.memoryUsage?.() ?? { heapUsed: 0, heapTotal: 0, rss: 0 };
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const rssKB = Math.round(memUsage.rss / 1024);

    const scanCount = scanCache.size;
    const modelName = nodeProcess?.env.MODEL_NAME || "Qwen3.5-27B-AWQ-4bit";
    const embeddingModel = nodeProcess?.env.OPENAI_EMBEDDING_MODEL || "Qwen3-Embedding-0.6B";

    const statusIcon = (ok: boolean) => (ok ? "✅" : "⚠️");
    const latencyStr = (ms: number) => (ms < 5000 ? `${ms}ms` : "timeout");

    const report = [
      `**ShieldNet Agent — System Status**`,
      ``,
      `**Core**`,
      `  Status:     🟢 RUNNING`,
      `  Uptime:     ${uptimeStr}`,
      `  Scans cached: ${scanCount}`,
      ``,
      `**Nosana GPU Infrastructure**`,
      `  ${statusIcon(llmStatus.ok)} LLM:        ${modelName} (${latencyStr(llmStatus.latencyMs)})`,
      `  ${statusIcon(embedStatus.ok)} Embeddings: ${embeddingModel} (${latencyStr(embedStatus.latencyMs)})`,
      `  Node:       Nosana decentralized GPU network`,
      ``,
      `**Scanner API**`,
      `  ${statusIcon(scannerStatus.ok)} scan.bughunt.tech (${latencyStr(scannerStatus.latencyMs)})`,
      `  Vectors:    26+ (XSS, SQLi, SSRF, CORS, headers, SSL, ports, DNS)`,
      ``,
      `**Runtime**`,
      `  Node.js:    ${nodeProcess?.version ?? "unknown"}`,
      `  Heap:       ${memMB}MB / ${memTotalMB}MB`,
      `  RSS:        ${rssKB}KB`,
      `  Platform:   ${nodeProcess?.platform ?? "unknown"}`,
    ].join("\n");

    if (callback) {
      await callback({ text: report });
    }

    return {
      success: true,
      data: {
        uptime: uptimeStr,
        nosana: {
          llm: { model: modelName, ok: llmStatus.ok, latencyMs: llmStatus.latencyMs },
          embeddings: { model: embeddingModel, ok: embedStatus.ok, latencyMs: embedStatus.latencyMs },
        },
        scanner: { url: SHIELDNET_API, ok: scannerStatus.ok },
        scansCount: scanCount,
        memory: { heapMB: memMB, totalMB: memTotalMB },
      },
    };
  },

  examples: [
    [
      { name: "{{user1}}", content: { text: "health" } },
      {
        name: "ShieldNet",
        content: {
          text: "**ShieldNet Agent — System Status**\n\nStatus: 🟢 RUNNING\nUptime: 5m 12s\n\n✅ LLM: Qwen3.5-27B-AWQ-4bit (234ms)\n✅ Embeddings: Qwen3-Embedding-0.6B (189ms)\n✅ Scanner: scan.bughunt.tech (145ms)",
        },
      },
    ],
    [
      { name: "{{user1}}", content: { text: "are you running?" } },
      {
        name: "ShieldNet",
        content: {
          text: "🟢 Yes — ShieldNet is live on Nosana GPU infrastructure.\nLLM: Qwen3.5-27B ✅ | Embeddings ✅ | Scanner ✅",
        },
      },
    ],
    [
      { name: "{{user1}}", content: { text: "status" } },
      {
        name: "ShieldNet",
        content: {
          text: "**ShieldNet Agent — System Status**\n\nNosana LLM: ✅ | Embeddings: ✅ | Scanner API: ✅",
        },
      },
    ],
  ] as ActionExample[][],
};

// ─── Plugin Definition ────────────────────────────────────────────────────

const shieldNetPlugin: Plugin = {
  name: "shieldnet",
  description:
    "ShieldNet Security Plugin — AI-powered vulnerability scanning, code analysis, red teaming, and executive security reports. Built by Hash Security.",
  actions: [
    helpAction,
    healthCheckAction,
    scanUrlAction,
    analyzeCodeAction,
    redTeamAction,
    securityReportAction,
    scanHistoryAction,
    compareSitesAction,
    scanGithubAction,
    exportReportAction,
    selfScanAction,
  ],
  providers: [],
  evaluators: [],
};

export default shieldNetPlugin;
