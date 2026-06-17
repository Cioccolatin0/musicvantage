import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers.js";

const PORT = parseInt(process.env.PORT || "3001");

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

  server.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
