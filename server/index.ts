import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer, get as httpGet } from "http";
import { get as httpsGet, request as httpsRequest } from "https";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./_core/context";
import { serveStatic, setupVite } from "./vite";
import * as localAuth from "./_core/localAuth";
import { ensureWorker, callPythonWorker } from "./python-worker";
import { setupWebSocket } from "./ws";
import { ensureTables } from "../db";
import { spawn, execFileSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let YT_DLP_PATH = "yt-dlp";
try {
  execFileSync("yt-dlp", ["--version"], { timeout: 5000, stdio: "ignore" });
} catch {
  try {
    const pyScripts = path.join(process.env.APPDATA || "", "Python", "Python313", "Scripts", "yt-dlp.exe");
    if (fs.existsSync(pyScripts)) { YT_DLP_PATH = pyScripts; }
    else {
      const alt = path.join(process.env.APPDATA || "", "Python", "Python312", "Scripts", "yt-dlp.exe");
      if (fs.existsSync(alt)) { YT_DLP_PATH = alt; }
    }
  } catch {}
  // Linux fallback: try python3 -m yt_dlp
  if (YT_DLP_PATH === "yt-dlp") {
    try {
      execFileSync("python3", ["-m", "yt_dlp", "--version"], { timeout: 5000, stdio: "ignore" });
      YT_DLP_PATH = "PYTHON_YT_DLP";
    } catch {}
  }
}
const PYTHON_SCRIPT = path.join(__dirname, "../ytmusic_api.py");

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  // CORS for cross-origin requests (Vercel frontend -> HF backend)
  app.use((_req, res, next) => {
    const origin = _req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Health check endpoint (for keep-alive pings)
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", uptime: process.uptime() });
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Image proxy - relays images from CORS-restricted origins (e.g. yt3.ggpht.com)
  const imageCache = new Map<string, { buf: Buffer; ct: string; expires: number }>();
  const IMAGE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

  app.get("/api/image-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith("http")) {
      res.status(400).json({ error: "Missing or invalid url" });
      return;
    }
    // Only allow proxying known image hosts to prevent abuse
    try {
      const parsed = new URL(url);
      const allowedHosts = ["yt3.ggpht.com", "yt3.googleusercontent.com", "lh3.googleusercontent.com", "i.ytimg.com", "img.youtube.com", "i.scdn.co", "mosaic.scdn.co", "image-cdn-ak.spotify.com"];
      if (!allowedHosts.some(h => parsed.hostname.endsWith(h))) {
        res.status(403).json({ error: "Host not allowed" });
        return;
      }
    } catch {
      res.status(400).json({ error: "Invalid URL" });
      return;
    }

    const cached = imageCache.get(url);
    if (cached && cached.expires > Date.now()) {
      res.setHeader("Content-Type", cached.ct);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(cached.buf);
      return;
    }

    try {
      const getClient = url.startsWith("https") ? httpsGet : httpGet;
      const data = await new Promise<Buffer>((resolve, reject) => {
        const req = getClient(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (upstream) => {
          if (upstream.statusCode && upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
            const redirectUrl = upstream.headers.location;
            const redirectGet = redirectUrl.startsWith("https") ? httpsGet : httpGet;
            redirectGet(redirectUrl, (redirectRes) => {
              const chunks: Buffer[] = [];
              redirectRes.on("data", (d: Buffer) => chunks.push(d));
              redirectRes.on("end", () => resolve(Buffer.concat(chunks)));
              redirectRes.on("error", reject);
            }).on("error", reject);
            return;
          }
          if (!upstream.statusCode || upstream.statusCode < 200 || upstream.statusCode >= 300) {
            reject(new Error(`HTTP ${upstream.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          upstream.on("data", (d: Buffer) => chunks.push(d));
          upstream.on("end", () => resolve(Buffer.concat(chunks)));
          upstream.on("error", reject);
        });
        req.on("error", reject);
        setTimeout(() => { req.destroy(); reject(new Error("timeout")); }, 10000);
      });

      const contentType = "image/jpeg";
      imageCache.set(url, { buf: data, ct: contentType, expires: Date.now() + IMAGE_CACHE_TTL });
      if (imageCache.size > 2000) {
        const oldest = imageCache.keys().next().value;
        if (oldest) imageCache.delete(oldest);
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(data);
    } catch (err) {
      res.status(500).json({ error: "Proxy error" });
    }
  });

  // Dynamic PWA manifest endpoint — returns different icons based on theme cookie
  const PUBLIC_DIR = path.resolve(__dirname, "../public");
  const THEME_ICONS_DIR = path.join(PUBLIC_DIR, "icons");
  const DEFAULT_THEME = "aurora";
  const THEME_NAMES = ["aurora", "lava", "neon", "midnight", "sunset", "candy", "dark"];

  function getIconPath(theme: string, size: number): string {
    const name = theme?.toLowerCase() || DEFAULT_THEME;
    const themedFile = path.join(THEME_ICONS_DIR, `${name}-${size}.png`);
    if (fs.existsSync(themedFile)) return themedFile;
    return path.join(PUBLIC_DIR, `icon-${size}.png`);
  }

  app.get("/api/manifest", (req, res) => {
    const theme = (req.cookies?.theme || DEFAULT_THEME).toLowerCase();
    const validTheme = THEME_NAMES.includes(theme) ? theme : DEFAULT_THEME;

    const icon192 = getIconPath(validTheme, 192);
    const icon512 = getIconPath(validTheme, 512);

    const manifest = {
      name: "MusicVantage",
      short_name: "MusicVantage",
      description: "MusicVantage - Ascolta musica in streaming ovunque",
      start_url: "/",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#7B46C9",
      orientation: "any",
      categories: ["music", "entertainment"],
      icons: [
        {
          src: `/icons/${validTheme}-192.png`,
          sizes: "192x192",
          type: "image/png",
          purpose: "any maskable",
        },
        {
          src: `/icons/${validTheme}-512.png`,
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    };

    // Fallback to default icons if themed ones don't exist on disk
    if (!fs.existsSync(path.join(THEME_ICONS_DIR, `${validTheme}-192.png`))) {
      manifest.icons[0].src = "/icon-192.png";
    }
    if (!fs.existsSync(path.join(THEME_ICONS_DIR, `${validTheme}-512.png`))) {
      manifest.icons[1].src = "/icon-512.png";
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache, max-age=0");
    res.json(manifest);
  });

  // Audio URL cache - resolves via yt-dlp once, serves instantly after
  const audioUrlCache = new Map<string, { url: string; expires: number }>();
  const AUDIO_CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

  async function resolveAudioUrl(videoId: string): Promise<string> {
    const cached = audioUrlCache.get(videoId);
    if (cached && cached.expires > Date.now()) return cached.url;

    const formatOpts = [
      "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio",
      "bestaudio",
      "worstaudio",
    ];

    for (const fmt of formatOpts) {
      try {
        const url = await new Promise<string>((resolve, reject) => {
          const args = YT_DLP_PATH === "PYTHON_YT_DLP"
            ? ["-m", "yt_dlp", "--no-warnings", "--no-playlist", "--no-progress", "--quiet", "-f", fmt, "--get-url", `https://www.youtube.com/watch?v=${videoId}`]
            : ["--no-warnings", "--no-playlist", "--no-progress", "--quiet", "-f", fmt, "--get-url", `https://www.youtube.com/watch?v=${videoId}`];
          const bin = YT_DLP_PATH === "PYTHON_YT_DLP" ? "python3" : YT_DLP_PATH;
          const proc = spawn(bin, args, {
            timeout: 15000,
            env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
          });
          let stdout = "";
          let stderr = "";
          proc.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
          proc.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
          proc.on("close", (code) => {
            const trimmed = stdout.trim();
            if (code === 0 && trimmed && trimmed.startsWith("http")) resolve(trimmed.split("\n")[0]);
            else reject(new Error(stderr.slice(0, 200)));
          });
          proc.on("error", reject);
          setTimeout(() => { try { proc.kill(); } catch {} reject(new Error("timeout")); }, 15000);
        });

        if (url) {
          audioUrlCache.set(videoId, { url, expires: Date.now() + AUDIO_CACHE_TTL });
          return url;
        }
      } catch {}
    }
    throw new Error("Failed to resolve audio URL");
  }

  // Audio proxy endpoint - resolves URL via cache, streams audio through server (avoids CORS)
  app.get("/api/audio-proxy/:videoId", async (req, res) => {
    const videoId = req.params.videoId;
    if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
      res.status(400).json({ error: "Invalid videoId" });
      return;
    }

    try {
      const url = await resolveAudioUrl(videoId);

      const getClient = url.startsWith("https") ? httpsGet : httpGet;

      getClient(url, (upstream) => {
        if (upstream.statusCode && upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
          const redirectUrl = upstream.headers.location;
          const redirectGet = redirectUrl.startsWith("https") ? httpsGet : httpGet;
          redirectGet(redirectUrl, (redirectRes) => {
            res.writeHead(redirectRes.statusCode || 200, {
              "Content-Type": redirectRes.headers["content-type"] || "audio/webm",
              "Content-Length": redirectRes.headers["content-length"] || undefined,
              "Accept-Ranges": "bytes",
              "Access-Control-Allow-Origin": "*",
            });
            redirectRes.pipe(res);
          }).on("error", (err) => {
            console.error(`[AudioProxy] Redirect stream error for ${videoId}:`, err.message);
            if (!res.headersSent) res.status(502).json({ error: "Stream error" });
          });
          return;
        }

        res.writeHead(upstream.statusCode || 200, {
          "Content-Type": upstream.headers["content-type"] || "audio/webm",
          "Content-Length": upstream.headers["content-length"] || undefined,
          "Accept-Ranges": "bytes",
          "Access-Control-Allow-Origin": "*",
        });
        upstream.pipe(res);
      }).on("error", (err) => {
        console.error(`[AudioProxy] Stream error for ${videoId}:`, err.message);
        if (!res.headersSent) res.status(502).json({ error: "Impossibile riprodurre questo brano" });
      });
    } catch (err) {
      console.error(`[AudioProxy] Failed for ${videoId}:`, (err as Error).message);
      if (!res.headersSent) res.status(502).json({ error: "Impossibile riprodurre questo brano" });
    }
  });

  // Returns resolved audio URL as JSON (no redirect, no CORS issues)
  app.get("/api/audio-url/:videoId", async (req, res) => {
    const videoId = req.params.videoId;
    if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
      res.status(400).json({ error: "Invalid videoId" });
      return;
    }
    try {
      const url = await resolveAudioUrl(videoId);
      res.json({ url });
    } catch (err) {
      // Fallback: try python worker
      try {
        const result = await callPythonWorker("audio_url", { videoId }, 0) as { url: string };
        if (result?.url) {
          res.json(result);
          return;
        }
      } catch {}
      res.status(502).json({ error: "Failed to resolve audio URL" });
    }
  });

  // Prefetch endpoint - resolve multiple video IDs in parallel in the background
  app.post("/api/prefetch-audio", express.json(), async (req, res) => {
    const ids = req.body?.videoIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "videoIds array required" });
      return;
    }
    res.json({ ok: true });
    const valid = ids.filter((id: string) => typeof id === "string" && /^[a-zA-Z0-9_-]{1,20}$/.test(id)).slice(0, 20);
    await Promise.allSettled(valid.map((id: string) => resolveAudioUrl(id).catch(() => {})));
  });

  // Audio stream proxy endpoint - uses yt-dlp to get audio URL server-side
  app.get("/api/audio-stream", async (req, res) => {
    const videoId = req.query.videoId as string;
    if (!videoId || !/^[a-zA-Z0-9_-]{1,20}$/.test(videoId)) {
      res.status(400).json({ error: "Invalid videoId" });
      return;
    }

    try {
      const result = await new Promise<{ url: string; videoId: string }>((resolve, reject) => {
        const proc = spawn(
          "python3",
          [PYTHON_SCRIPT, "audio_url", JSON.stringify({ videoId })],
          { timeout: 45000, env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" } }
        );
        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (d) => (stdout += d.toString()));
        proc.stderr.on("data", (d) => (stderr += d.toString()));
        proc.on("close", () => {
          try {
            const parsed = JSON.parse(stdout.trim());
            if (parsed.error) reject(new Error(parsed.error));
            else resolve(parsed);
          } catch {
            reject(new Error(stderr || stdout || "Python error"));
          }
        });
        proc.on("error", reject);
      });

      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: msg });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    // Guard against requests to the bare mount path (e.g., GET /api/trpc)
    // Express strips the mount path from req.path, so a request to
    // /api/trpc yields req.path === "/" which tRPC can't resolve.
    (req, res, next) => {
      const procedurePath = req.path.substring(1);
      if (!procedurePath) {
        res.status(404).json({ error: "Missing tRPC procedure path" });
        return;
      }
      next();
    },
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  setupWebSocket(server);

  // Dynamic service worker — injects theme name into CACHE_NAME so
  // the browser detects a byte-difference when the theme changes and
  // triggers a SW update (which re-fetches the themed manifest).
  app.get("/sw.js", (req, res) => {
    const theme = (req.cookies?.theme || DEFAULT_THEME).toLowerCase();
    const validTheme = THEME_NAMES.includes(theme) ? theme : DEFAULT_THEME;
    const swPath = path.join(PUBLIC_DIR, "sw.js");
    let content = fs.readFileSync(swPath, "utf-8");
    content = content.replace(
      /const CACHE_NAME\s*=\s*"[^"]+"/,
      `const CACHE_NAME = "musicvantage-${validTheme}"`
    );
    res.setHeader("Content-Type", "application/javascript");
    res.setHeader("Cache-Control", "no-cache");
    res.send(content);
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server, port);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "4000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  await ensureTables().catch((err) => {
    console.error("[Database] Table creation failed:", err.message);
  });

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);

    try {
      const codes = await localAuth.getInviteCodes();
      console.log(`[Auth] Found ${codes.length} invite code(s) in database`);
      if (codes.length === 0) {
        const code = await localAuth.generateInviteCode("system", 90);
        console.log(`\n  ====================================`);
        console.log(`  Default invite code: ${code.code}`);
        console.log(`  ====================================\n`);
      } else {
        const unused = codes.filter(c => !c.usedBy);
        if (unused.length > 0) {
          console.log(`\n  Available invite code(s):`);
          unused.forEach(c => console.log(`    - ${c.code}`));
          console.log(``);
        } else {
          console.log(`\n  All invite codes used. Generate a new one from Admin panel.\n`);
        }
      }
    } catch (err) {
      console.error("[Auth] Failed to check/generate invite codes:", (err as Error).message);
      console.error("[Auth] Stack:", (err as Error).stack);
    }

    ensureWorker().then(() => {
      console.log("[Python Worker] Ready (pre-warmed)");
    }).catch((err) => {
      console.error("[Python Worker] Failed to start:", err.message);
    });
  });
}

startServer().catch(console.error);
