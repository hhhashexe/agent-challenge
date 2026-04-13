/**
 * ShieldNet Security Agent — ElizaOS Plugin
 */

import { type Plugin } from "@elizaos/core";

const scanTarget = async (target: string): Promise<Record<string, unknown>> => {
  try {
    const response = await fetch("https://scan.bughunt.tech/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, mode: "standard" }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Scan API error: ${response.status}`);
    return await response.json() as Record<string, unknown>;
  } catch (e) {
    return { error: String(e), target, status: "scan_failed" };
  }
};

const formatScanReport = (data: Record<string, unknown>, target: string): string => {
  if (data.error) {
    return `⚠️ Could not reach ShieldNet scanner for ${target}.\nTry the web interface: https://scan.bughunt.tech`;
  }
  const grade = (data.grade as string) || "?";
  const score = data.score ?? "?";
  const findings = (data.findings as unknown[]) || [];
  const critical = findings.filter((f: unknown) => (f as Record<string,string>).severity === "CRITICAL").length;
  const high = findings.filter((f: unknown) => (f as Record<string,string>).severity === "HIGH").length;
  const medium = findings.filter((f: unknown) => (f as Record<string,string>).severity === "MEDIUM").length;
  const low = findings.filter((f: unknown) => (f as Record<string,string>).severity === "LOW").length;
  const gradeEmoji: Record<string, string> = { A: "✅", B: "🟡", C: "🟠", D: "🔴", F: "💀" };

  let report = `${gradeEmoji[grade] || "❓"} ShieldNet Scan — ${target}\nGrade: ${grade} | Score: ${score}/100\n\n`;
  report += `🔴 ${critical} CRITICAL | 🟠 ${high} HIGH | 🟡 ${medium} MEDIUM | 🟢 ${low} LOW\n`;

  if (findings.length === 0) {
    report += "\n✅ No vulnerabilities detected.";
  } else {
    const top = findings.slice(0, 3);
    report += "\nTop findings:\n";
    for (const f of top) {
      const ff = f as Record<string, string>;
      report += `• [${ff.severity}] ${ff.title || ff.name || "Finding"}\n`;
    }
  }
  return report;
};

const quickAnalyze = (config: string): string => {
  const redFlags: string[] = [];
  const checks: [RegExp, string, string][] = [
    [/run_shell|exec_command|shell_exec|subprocess/i, "CRITICAL", "Unrestricted shell execution"],
    [/sk-[a-zA-Z0-9]{20,}|api[_-]?key\s*[:=]\s*["'][^"']{10,}/i, "CRITICAL", "Hardcoded API key"],
    [/password\s*[:=]\s*["'][^"']{3,}/i, "CRITICAL", "Hardcoded password"],
    [/eval\s*\(|new Function\s*\(/i, "CRITICAL", "Dynamic code execution"],
    [/read_file.*\.\.\//i, "HIGH", "Path traversal via file read"],
    [/ignore.*previous.*instruction|disregard.*system/i, "HIGH", "Prompt injection pattern"],
    [/cors.*\*|access-control-allow-origin.*\*/i, "MEDIUM", "CORS wildcard"],
    [/debug.*true/i, "MEDIUM", "Debug mode enabled"],
  ];
  for (const [pattern, severity, description] of checks) {
    if (pattern.test(config)) redFlags.push(`[${severity}] ${description}`);
  }
  if (redFlags.length === 0) return "✅ No obvious red flags.\nFor full 26-vector audit: https://scan.bughunt.tech";
  const grade = redFlags.some(f => f.includes("CRITICAL")) ? "F" : "D";
  return `🔍 Quick Analysis — Grade: ${grade}\n\n${redFlags.map(f => `• ${f}`).join("\n")}\n\nFull report: https://scan.bughunt.tech`;
};

export const shieldnetPlugin: Plugin = {
  name: "shieldnet-security",
  description: "ShieldNet AI security scanner for AI agents and MCP servers",
  actions: [
    {
      name: "SECURITY_SCAN",
      description: "Scan a URL for security vulnerabilities using ShieldNet",
      similes: ["SCAN", "AUDIT_URL", "CHECK_SECURITY", "VULNERABILITY_SCAN"],
      validate: async (_runtime, message) => {
        const text = (message.content as { text?: string }).text || "";
        return /scan|audit|check|security/i.test(text) && /https?:\/\/|localhost/.test(text);
      },
      handler: async (_runtime, message, _state, _options, callback) => {
        const text = (message.content as { text?: string }).text || "";
        const urlMatch = text.match(/https?:\/\/[^\s]+|localhost(?::\d+)?(?:\/[^\s]*)?/);
        if (!urlMatch) {
          if(callback) await callback({ text: "Please provide a URL. Example: 'scan https://your-agent.com'" });
          return;
        }
        const target = urlMatch[0];
        if(callback) await callback({ text: `🔍 Scanning ${target}... (30 seconds)` });
        const results = await scanTarget(target);
        if(callback) await callback({ text: formatScanReport(results, target) });
      },
      examples: [],
    },
    {
      name: "ANALYZE_CONFIG",
      description: "Analyze an agent config or SKILL.md for security issues",
      similes: ["ANALYZE", "AUDIT_CONFIG", "REVIEW_SKILL"],
      validate: async (_runtime, message) => {
        const text = (message.content as { text?: string }).text || "";
        return /analyze|audit|review|check/i.test(text) && /{|SKILL|tool|plugin|config/i.test(text);
      },
      handler: async (_runtime, message, _state, _options, callback) => {
        const text = (message.content as { text?: string }).text || "";
        if(callback) await callback({ text: quickAnalyze(text) });
      },
      examples: [],
    },
    {
      name: "REPORT_CAPABILITIES",
      description: "List what ShieldNet can detect",
      similes: ["CAPABILITIES", "HELP", "WHAT_CAN_YOU_DO"],
      validate: async (_runtime, message) => {
        const text = (message.content as { text?: string }).text || "";
        return /what.*can|capabilit|help|how.*work/i.test(text);
      },
      handler: async (_runtime, _message, _state, _options, callback) => {
        if(callback) await callback({
          text: `🛡️ ShieldNet Security Agent\n\n26-vector detection, OWASP MCP Top 10:\n\n🔴 CRITICAL: Prompt injection, hardcoded secrets, unrestricted shell/eval\n🟠 HIGH: Path traversal, SSRF, missing auth, wildcard permissions\n🟡 MEDIUM: CORS wildcards, debug mode, info disclosure\n\nCommands:\n• "scan https://your-agent.com"\n• Paste any config/SKILL.md for quick analysis\n\nWeb: https://scan.bughunt.tech\nRunning on Nosana GPU 🚀`,
        });
      },
      examples: [],
    },
  ],
  providers: [],
  evaluators: [],
};

export default shieldnetPlugin;
