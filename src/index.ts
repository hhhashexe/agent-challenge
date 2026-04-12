/**
 * ShieldNet Security Agent — ElizaOS Plugin
 * 
 * AI security agent for auditing MCP servers, agent configs, and skill definitions.
 * Deployed on Nosana decentralized GPU compute.
 * 
 * Capabilities:
 * - Scan URLs and agent configs for security vulnerabilities
 * - 26-vector detection framework mapped to OWASP MCP Top 10
 * - Severity scoring (CRITICAL/HIGH/MEDIUM/LOW)
 * - Audit certificate generation
 */

import { type Plugin, type Action, type IAgentRuntime, type Memory, type State, type HandlerCallback } from "@elizaos/core";

// Security scan via ShieldNet API
const scanTarget = async (target: string): Promise<object> => {
  try {
    const response = await fetch("https://scan.bughunt.tech/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, mode: "standard" }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Scan API error: ${response.status}`);
    return await response.json();
  } catch (e) {
    return { error: String(e), target, status: "scan_failed" };
  }
};

// Format scan results for display
const formatScanReport = (data: Record<string, unknown>, target: string): string => {
  if ((data as any).error) {
    return `⚠️ Could not reach ShieldNet scanner for ${target}. Try the web interface: https://scan.bughunt.tech`;
  }

  const grade = (data as any).grade || "?";
  const score = (data as any).score ?? "?";
  const findings = (data as any).findings || [];
  const critical = findings.filter((f: any) => f.severity === "CRITICAL").length;
  const high = findings.filter((f: any) => f.severity === "HIGH").length;
  const medium = findings.filter((f: any) => f.severity === "MEDIUM").length;
  const low = findings.filter((f: any) => f.severity === "LOW").length;

  const gradeEmoji: Record<string, string> = { A: "✅", B: "🟡", C: "🟠", D: "🔴", F: "💀" };
  const emoji = gradeEmoji[grade] || "❓";

  let report = `${emoji} ShieldNet Scan Report — ${target}\n`;
  report += `Grade: ${grade} | Score: ${score}/100\n\n`;
  report += `Findings: 🔴 ${critical} CRITICAL | 🟠 ${high} HIGH | 🟡 ${medium} MEDIUM | 🟢 ${low} LOW\n\n`;

  if (findings.length === 0) {
    report += "✅ No vulnerabilities detected. Certificate ready for issuance.\n";
  } else {
    const topFindings = findings.slice(0, 3);
    report += "Top findings:\n";
    for (const f of topFindings) {
      const sev = (f as any).severity || "UNKNOWN";
      const title = (f as any).title || (f as any).name || "Finding";
      const fix = (f as any).fix || (f as any).remediation || "";
      report += `• [${sev}] ${title}${fix ? ` — Fix: ${fix}` : ""}\n`;
    }
    if (findings.length > 3) {
      report += `...and ${findings.length - 3} more. Full report: https://scan.bughunt.tech\n`;
    }
  }

  return report;
};

// Analyze agent config text for quick red flags
const quickAnalyze = (config: string): string => {
  const redFlags: string[] = [];

  const checks: [RegExp, string, string][] = [
    [/run_shell|exec_command|shell_exec|subprocess/i, "CRITICAL", "Unrestricted shell execution"],
    [/sk-[a-zA-Z0-9]{20,}|api[_-]?key\s*[:=]\s*["'][^"']{10,}/i, "CRITICAL", "Hardcoded API key/secret detected"],
    [/password\s*[:=]\s*["'][^"']{3,}/i, "CRITICAL", "Hardcoded password detected"],
    [/read_file|readFile.*\.\.\//i, "HIGH", "Path traversal via file read"],
    [/fetch\s*\(.*\+|url.*=.*req\./i, "HIGH", "Potential SSRF via dynamic URL"],
    [/eval\s*\(|new Function\s*\(/i, "CRITICAL", "Dynamic code execution (eval)"],
    [/ignore.*previous.*instruction|disregard.*system/i, "HIGH", "Prompt injection pattern in description"],
    [/allow_any|permissions.*\*/i, "HIGH", "Wildcard permissions"],
    [/debug.*true|NODE_ENV.*development/i, "MEDIUM", "Debug mode in production config"],
    [/cors.*\*|access-control-allow-origin.*\*/i, "MEDIUM", "CORS wildcard — any origin allowed"],
  ];

  for (const [pattern, severity, description] of checks) {
    if (pattern.test(config)) {
      redFlags.push(`[${severity}] ${description}`);
    }
  }

  if (redFlags.length === 0) {
    return "✅ Quick analysis: No obvious red flags in the provided config.\n\nFor a full 26-vector audit, provide a URL: 'scan https://your-agent.com'";
  }

  const criticalCount = redFlags.filter(f => f.includes("CRITICAL")).length;
  const highCount = redFlags.filter(f => f.includes("HIGH")).length;
  const grade = criticalCount > 0 ? "F" : highCount > 0 ? "D" : "C";

  let result = `🔍 Quick Security Analysis — Grade: ${grade}\n\n`;
  result += "Red flags detected:\n";
  result += redFlags.map(f => `• ${f}`).join("\n");
  result += "\n\nFor full audit with remediation: https://scan.bughunt.tech";

  return result;
};

// Action: Scan a URL
const scanAction: Action = {
  name: "SECURITY_SCAN",
  description: "Scan a URL or IP address for security vulnerabilities using ShieldNet",
  similes: ["SCAN", "AUDIT_URL", "CHECK_SECURITY", "SCAN_TARGET", "VULNERABILITY_SCAN"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content as any).text || "";
    return /scan|audit|check|vuln|security/i.test(text) && /https?:\/\/|localhost|\d+\.\d+\.\d+\.\d+/.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: unknown,
    callback: HandlerCallback
  ) => {
    const text = (message.content as any).text || "";
    const urlMatch = text.match(/https?:\/\/[^\s]+|localhost(?::\d+)?(?:\/[^\s]*)?|\d+\.\d+\.\d+\.\d+(?::\d+)?/);
    if (!urlMatch) {
      await callback({ text: "Please provide a URL to scan. Example: 'scan https://your-agent.com'" });
      return;
    }
    const target = urlMatch[0];
    await callback({ text: `🔍 Initiating ShieldNet scan on ${target}...\nRunning 26-vector security analysis. This takes ~30 seconds.` });
    const results = await scanTarget(target);
    const report = formatScanReport(results as Record<string, unknown>, target);
    await callback({ text: report });
  },
  examples: [
    [
      { user: "user", content: { text: "scan https://paylock.xyz" } },
      { user: "ShieldNet", content: { text: "🔍 Initiating ShieldNet scan on https://paylock.xyz..." } }
    ]
  ],
};

// Action: Analyze agent config
const analyzeConfigAction: Action = {
  name: "ANALYZE_CONFIG",
  description: "Analyze an agent configuration, SKILL.md, or tool definition for security vulnerabilities",
  similes: ["ANALYZE", "AUDIT_CONFIG", "CHECK_CONFIG", "REVIEW_SKILL", "INSPECT"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content as any).text || "";
    return (
      (/analyze|audit|check|review|inspect/i.test(text)) &&
      (/{|SKILL\.md|tool|plugin|config|permission/i.test(text))
    );
  },
  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: unknown,
    callback: HandlerCallback
  ) => {
    const text = (message.content as any).text || "";
    const report = quickAnalyze(text);
    await callback({ text: report });
  },
  examples: [
    [
      { user: "user", content: { text: 'audit this config: {"tools": [{"name": "run_shell"}]}' } },
      { user: "ShieldNet", content: { text: "🔴 CRITICAL: Unrestricted shell execution detected..." } }
    ]
  ],
};

// Action: Report capabilities
const capabilitiesAction: Action = {
  name: "REPORT_CAPABILITIES",
  description: "Explain what ShieldNet can audit and what vulnerabilities it detects",
  similes: ["CAPABILITIES", "WHAT_CAN_YOU_DO", "HELP", "HOW_TO_USE"],
  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content as any).text || "";
    return /what.*can|capabilit|how.*work|help|what.*check|what.*detect/i.test(text);
  },
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
    _options: unknown,
    callback: HandlerCallback
  ) => {
    await callback({
      text: `🛡️ ShieldNet Security Agent — Capabilities\n\nI scan AI agents, MCP servers, and skill configs for:\n\n🔴 CRITICAL\n• Prompt injection via tool descriptions\n• Hardcoded API keys & secrets\n• Unrestricted shell/code execution\n• Dynamic eval() usage\n\n🟠 HIGH\n• Path traversal via file operations\n• SSRF via dynamic URL construction\n• Missing authentication on sensitive endpoints\n• Excessive permissions (wildcard scopes)\n\n🟡 MEDIUM\n• CORS wildcards\n• Debug mode in production\n• Verbose error messages leaking internals\n• Missing rate limiting\n\n**To scan a URL:**\n"scan https://your-agent.com"\n\n**To analyze a config:**\nPaste your SKILL.md or tool JSON\n\n**Web interface:** https://scan.bughunt.tech\n\nRunning on Nosana decentralized GPU — privacy-first, censorship-resistant.`
    });
  },
  examples: [],
};

export const shieldnetPlugin: Plugin = {
  name: "shieldnet-security",
  description: "ShieldNet AI security scanner — audit agent configs, MCP servers, and skills for vulnerabilities",
  actions: [scanAction, analyzeConfigAction, capabilitiesAction],
  providers: [],
  evaluators: [],
};

export default shieldnetPlugin;
