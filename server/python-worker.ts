import { spawn, ChildProcess, execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_SCRIPT = path.join(__dirname, "../ytmusic_api.py");

let PYTHON_BIN = "python3";
try {
  execFileSync("python3", ["--version"], { timeout: 3000, stdio: "ignore" });
} catch {
  try {
    execFileSync("python", ["--version"], { timeout: 3000, stdio: "ignore" });
    PYTHON_BIN = "python";
  } catch {}
}

let _proc: ChildProcess | null = null;
let _queue: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map();
let _nextId = 1;
let _pendingStderr = "";
let _warmed = false;
const _inflight: Map<string, Promise<unknown>> = new Map();

function startWorker(): Promise<void> {
  if (_proc) return Promise.resolve();

  return new Promise((resolve, reject) => {
    _proc = spawn(PYTHON_BIN, [PYTHON_SCRIPT, "--worker"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });

    const rl = createInterface({ input: _proc.stdout! });
    rl.on("line", (line: string) => {
      try {
        const msg = JSON.parse(line.trim());
        const handlers = _queue.get(msg.id);
        if (handlers) {
          _queue.delete(msg.id);
          if (msg.error) {
            handlers.reject(new Error(msg.error));
          } else if (msg.result && typeof msg.result === "object" && msg.result.error) {
            handlers.reject(new Error(msg.result.error));
          } else {
            handlers.resolve(msg.result);
          }
        }
        if (!_warmed && msg.id === 0) {
          _warmed = true;
        }
      } catch {
        if (line.trim()) {
          console.error("[Python Worker] Parse error:", line.slice(0, 200));
        }
      }
    });

  _proc.stderr?.on("data", (d: Buffer) => {
    const text = d.toString();
    _pendingStderr += text;
    if (_pendingStderr.length > 2000) {
      _pendingStderr = _pendingStderr.slice(-1000);
    }
    // Reduce noisy stderr flooding from the python worker; only log trimmed lines
    const trimmed = text.trim();
    if (trimmed.length > 0) console.error("[Python Worker]", trimmed.slice(0, 1000));
  });

    _proc.on("exit", (code) => {
      console.error(`[Python Worker] Exited with code ${code}. Restarting...`);
      _proc = null;
      _warmed = false;
      _startupPromise = null;
      for (const [, handler] of _queue) {
        handler.reject(new Error("Python worker process died"));
      }
      _queue.clear();
    });

    _proc.on("error", (err) => {
      console.error("[Python Worker] Error:", err.message);
      _proc = null;
      reject(err);
    });

    resolve();
  });
}

let _startupPromise: Promise<void> | null = null;

export function ensureWorker(): Promise<void> {
  if (_proc && _warmed) return Promise.resolve();
  if (_startupPromise) return _startupPromise;
  _startupPromise = startWorker().then(() => {
    return new Promise<void>((resolve) => {
  const pingId = ++_nextId;
  _queue.set(pingId, {
    resolve: () => {
      _warmed = true;
      resolve();
    },
    reject: () => {
      _warmed = true;
      resolve();
    },
  });
  if (_proc?.stdin) {
    _proc.stdin.write(JSON.stringify({ id: pingId, action: "ping", args: {} }) + "\n");
  }
      // Give the worker a short time to warm up and respond. If it doesn't
      // respond within 2s we still resolve (worker will continue to warm in
      // background) but we mark as warmed so the server doesn't block UI.
      setTimeout(() => {
        if (!_warmed) {
          _warmed = true;
          resolve();
        }
      }, 2000);
    });
  });
  return _startupPromise;
}

const _concurrencyLimit = 3;
let _activeCount = 0;
const _pendingQueue: (() => void)[] = [];

async function acquireSlot(): Promise<void> {
  if (_activeCount < _concurrencyLimit) {
    _activeCount++;
    return;
  }
  return new Promise((resolve) => {
    _pendingQueue.push(() => {
      _activeCount++;
      resolve();
    });
  });
}

function releaseSlot() {
  _activeCount--;
  const next = _pendingQueue.shift();
  if (next) setImmediate(next);
}

export async function callPythonWorker(
  action: string,
  args: Record<string, unknown>,
  cacheTtlMs: number = 0
): Promise<unknown> {
  const cacheKey = `${action}:${JSON.stringify(args)}`;

  // Coalesce duplicate in-flight requests
  const existing = _inflight.get(cacheKey);
  if (existing) return existing;

  await ensureWorker();

  if (!_proc?.stdin) {
    _startupPromise = null;
    await ensureWorker();
  }

  await acquireSlot();

  const timeoutMs = action === "import_playlist" ? 1800000 : action === "audio_url" ? 180000 : 60000;
  const promise = new Promise((resolve, reject) => {
    const id = ++_nextId;
    const timer = setTimeout(() => {
      _queue.delete(id);
      _inflight.delete(cacheKey);
      reject(new Error(`Python timeout after ${timeoutMs / 1000}s for action: ${action}`));
    }, timeoutMs);

    _queue.set(id, {
      resolve: (data: unknown) => {
        clearTimeout(timer);
        _inflight.delete(cacheKey);
        releaseSlot();
        resolve(data);
      },
      reject: (err: Error) => {
        clearTimeout(timer);
        _inflight.delete(cacheKey);
        releaseSlot();
        reject(err);
      },
    });

    try {
      if (!_proc?.stdin) {
        _queue.delete(id);
        _inflight.delete(cacheKey);
        clearTimeout(timer);
        releaseSlot();
        reject(new Error("Python worker not running"));
        return;
      }
      _proc.stdin.write(JSON.stringify({ id, action, args }) + "\n");
    } catch (err) {
      _queue.delete(id);
      _inflight.delete(cacheKey);
      clearTimeout(timer);
      releaseSlot();
      reject(new Error("Failed to send to Python worker"));
    }
  });

  _inflight.set(cacheKey, promise);
  return promise;
}

export function clearPythonWorkerCache() {
  return { ok: true };
}

export function getPythonWorkerCacheSize() {
  return 0;
}
