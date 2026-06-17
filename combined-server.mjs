import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers.js";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_PORT = parseInt(process.env.PORT || "3000");
const VITE_PORT = 5173;

async function createContext({ req, res }) {
  return { req, res, user: undefined };
}

async function start() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );

  server.listen(API_PORT, () => {
    console.log(`API server running on http://localhost:${API_PORT}`);
  });

  // Start Vite dev server
  const vitePath = path.join(__dirname, "node_modules", "vite", "bin", "vite.js");
  const vite = spawn(process.execPath, [vitePath], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development" },
  });

  vite.on("error", (err) => console.error("Vite error:", err));
  vite.on("exit", (code) => console.log(`Vite exited with code ${code}`));
}

start().catch(console.error);
