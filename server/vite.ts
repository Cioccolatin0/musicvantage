import type { Express } from "express";
import express from "express";
import type { Server } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupVite(app: Express, server: Server) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { server, clientPort: 3000 } },
    appType: "custom",
    legacy: { skipWebSocketTokenCheck: true },
  });
  app.use(vite.middlewares);

  // SPA fallback: serve index.html for HTML navigation requests only
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes
    if (url.startsWith("/api")) return next();

    // Skip requests for files with extensions (Vite handles these)
    if (/\.[a-zA-Z0-9]+$/.test(url)) return next();

    // Skip internal Vite requests
    if (url.startsWith("/@")) return next();

    let template = fs.readFileSync(
      path.resolve(__dirname, "../index.html"),
      "utf-8"
    );

    const theme = (req.cookies?.theme || "aurora").toLowerCase();
    template = template.replace(
      'href="/manifest.json"',
      `href="/icons/${theme}-manifest.json"`
    );
    template = template.replace(
      'href="/icons/aurora-192.png"',
      `href="/icons/${theme}-192.png"`
    );

    try {
      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch {
      next();
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(distPath)) {
    // Serve only assets, not index.html (SPA fallback handles HTML with theme injection)
    app.use(express.static(distPath, { index: false }));
    // SPA fallback for production — inject theme-specific manifest & icons
    app.get("*", (req, res) => {
      const filePath = path.join(distPath, "index.html");
      let content = fs.readFileSync(filePath, "utf-8");
      const theme = (req.cookies?.theme || "aurora").toLowerCase();
      content = content.replace(
        'href="/manifest.json"',
        `href="/icons/${theme}-manifest.json"`
      );
      content = content.replace(
        'href="/icons/aurora-192.png"',
        `href="/icons/${theme}-192.png"`
      );
      res.setHeader("Content-Type", "text/html");
      res.send(content);
    });
  }
}
