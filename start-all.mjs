import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

function startServer(name, cmd, args) {
  const proc = spawn(cmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: "development" },
  });

  proc.stdout.on("data", (d) => {
    d.toString().split("\n").filter(Boolean).forEach((l) => log(name, l));
  });

  proc.stderr.on("data", (d) => {
    d.toString().split("\n").filter(Boolean).forEach((l) => log(name, l));
  });

  proc.on("exit", (code) => {
    log(name, `exited with code ${code}`);
  });

  return proc;
}

const tsxLoader = path.join(__dirname, "node_modules", "tsx", "dist", "loader.mjs");
const serverEntry = path.join(__dirname, "server", "index.ts");

const tsxLoaderUrl = "file:///" + tsxLoader.replace(/\\/g, "/");
const expressProc = startServer("Express", process.execPath, [
  "--import", tsxLoaderUrl,
  serverEntry,
]);

setTimeout(() => {
  const viteProc = startServer("Vite", process.execPath, [
    path.join(__dirname, "node_modules", "vite", "bin", "vite.js"),
  ]);

  log("System", "============================================");
  log("System", "  Servers avviati!");
  log("System", "  Frontend: http://localhost:8080/");
  log("System", "  Backend:  http://localhost:3000/");
  log("System", "============================================");
  log("System", "");
  log("System", "  Premi Ctrl+C per fermare i server");
}, 12000);

process.on("SIGINT", () => { log("System", "Arresto..."); process.exit(0); });
process.on("SIGTERM", () => { log("System", "Arresto..."); process.exit(0); });
setInterval(() => {}, 60000);
