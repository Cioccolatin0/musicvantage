const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const dir = __dirname;
const node = process.execPath;

function spawnDetached(name, cmd, args) {
  const logFile = path.join(dir, name + ".log");
  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");

  const child = spawn(cmd, args, {
    detached: true,
    stdio: ["ignore", out, err],
    cwd: dir,
    env: Object.assign({}, process.env, { NODE_ENV: "development", PORT: "4000" }),
    windowsHide: true,
  });

  child.unref();
}

const loader = path.join(dir, "node_modules", "tsx", "dist", "loader.mjs");
const loaderUrl = "file:///" + loader.replace(/\\/g, "/");

// Express API server (also serves Vite frontend via middleware)
spawnDetached("express", node, [
  "--import", loaderUrl,
  path.join(dir, "server", "index.ts"),
]);

console.log("OK");
