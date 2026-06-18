const MAX_LOGS = 500;
const logs: { time: string; level: string; msg: string }[] = [];

function addLog(level: string, args: any[]) {
  const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  logs.push({ time: new Date().toISOString(), level, msg });
  if (logs.length > MAX_LOGS) logs.shift();
}

const _log = console.log;
const _error = console.error;
const _warn = console.warn;

console.log = (...args: any[]) => { addLog("info", args); _log.apply(console, args); };
console.error = (...args: any[]) => { addLog("error", args); _error.apply(console, args); };
console.warn = (...args: any[]) => { addLog("warn", args); _warn.apply(console, args); };

export function getLogs(limit = 200) {
  return logs.slice(-limit);
}

export function getLogsHtml(limit = 200): string {
  const recent = logs.slice(-limit);
  const lines = recent.map((l) => {
    const color = l.level === "error" ? "#ff4444" : l.level === "warn" ? "#ffaa00" : "#cccccc";
    return `<div style="color:${color};font-family:monospace;font-size:12px;padding:2px 0;border-bottom:1px solid #222"><span style="color:#666">${l.time}</span> [${l.level.toUpperCase()}] ${escapeHtml(l.msg)}</div>`;
  }).join("");
  return `<!DOCTYPE html><html><head><title>MusicVantage Logs</title><meta charset="utf-8"><style>body{background:#111;color:#ccc;padding:16px}h2{color:#fff;font-family:sans-serif}</style></head><body><h2>MusicVantage Logs (ultimi ${limit})</h2>${lines}<script>setTimeout(()=>location.reload(),5000)</script></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
