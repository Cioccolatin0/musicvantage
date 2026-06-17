import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import fs from "fs";

function startDetached(cmd, args, logFile) {
  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");
  const proc = spawn(cmd, args, {
    detached: true,
    stdio: ["ignore", out, err],
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: "development" },
  });
  proc.unref();
  return proc;
}

// Start Express API server (detached)
const tsxLoader = path.join(__dirname, "node_modules", "tsx", "dist", "loader.mjs");
const tsxLoaderUrl = "file:///" + tsxLoader.replace(/\\/g, "/");

startDetached(process.execPath, [
  "--import", tsxLoaderUrl,
  path.join(__dirname, "server", "index.ts"),
], path.join(__dirname, "server.log"));

console.log("Express server starting...");

// Start Vite dev server (detached)
startDetached(process.execPath, [
  path.join(__dirname, "node_modules", "vite", "bin", "vite.js"),
], path.join(__dirname, "vite.log"));

console.log("Vite server starting...");
console.log("");
console.log("============================================");
console.log("  Servers avviati come processi indipendenti!");
console.log("  Frontend: http://localhost:8080/");
console.log("  Backend:  http://localhost:3000/");
console.log("============================================");
console.log("");
console.log("Per fermare i server usa Task Manager o:");
console.log("  taskkill /F /IM node.exe");
