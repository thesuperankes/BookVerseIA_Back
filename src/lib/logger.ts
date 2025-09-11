// src/utils/logger.ts
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

type LevelName = "debug" | "info" | "warn" | "error" | "silent";
const LEVELS: Record<Exclude<LevelName, "silent">, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  level?: LevelName;              // default: "info"
  toFile?: boolean;               // default: false
  filePath?: string;              // default: "./logs/app.log"
  maxSizeBytes?: number;          // default: 5MB
  maxBackups?: number;            // default: 3
  prettyConsole?: boolean;        // default: true
  colorConsole?: boolean;         // default: true
  baseContext?: Record<string, any>; // contexto fijo en todos los logs
}

type AnyObj = Record<string, any>;

function isError(x: any): x is Error {
  return x instanceof Error || (x && typeof x === "object" && "stack" in x && "message" in x);
}

function safeError(err: any) {
  if (!isError(err)) return err;
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
  };
}

function safeStringify(obj: any, space?: number) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_k, v) => {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      if (v instanceof Map) return Object.fromEntries(v);
      if (v instanceof Set) return Array.from(v);
      if (v instanceof Error) return safeError(v);
      return v;
    },
    space
  );
}

// Colorcitos sin dependencias
const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};
function colorize(s: string, level: LevelName, enabled: boolean) {
  if (!enabled) return s;
  switch (level) {
    case "debug": return C.blue + s + C.reset;
    case "info":  return s;
    case "warn":  return C.yellow + s + C.reset;
    case "error": return C.red + s + C.reset;
    default:      return s;
  }
}

function iso() { return new Date().toISOString(); }

async function ensureDir(fp: string) {
  await fsp.mkdir(path.dirname(fp), { recursive: true });
}

async function rotateIfNeeded(fp: string, maxSize: number, maxBackups: number) {
  try {
    const st = await fsp.stat(fp);
    if (st.size < maxSize) return;
  } catch { return; } // no file yet

  // simple rotation: .log -> .log.1, .log.1 -> .log.2 ...
  for (let i = maxBackups - 1; i >= 1; i--) {
    const src = `${fp}.${i}`;
    const dst = `${fp}.${i + 1}`;
    if (fs.existsSync(src)) await fsp.rename(src, dst).catch(() => {});
  }
  if (fs.existsSync(fp)) await fsp.rename(fp, `${fp}.1`).catch(() => {});
}

class Logger {
  private static instance: Logger | null = null;
  private opts: Required<LoggerOptions>;
  private fileQueue: Promise<void> = Promise.resolve();

  private constructor(opts?: LoggerOptions) {
    this.opts = {
      level: (process.env.LOG_LEVEL as LevelName) || opts?.level || "info",
      toFile: opts?.toFile ?? (process.env.LOG_TO_FILE === "true"),
      filePath: opts?.filePath || process.env.LOG_FILE_PATH || "./logs/app.log",
      maxSizeBytes: opts?.maxSizeBytes ?? Number(process.env.LOG_MAX_SIZE || 5 * 1024 * 1024),
      maxBackups: opts?.maxBackups ?? Number(process.env.LOG_MAX_BACKUPS || 3),
      prettyConsole: opts?.prettyConsole ?? (process.env.LOG_PRETTY_CONSOLE !== "false"),
      colorConsole: opts?.colorConsole ?? (process.env.LOG_COLOR_CONSOLE !== "false"),
      baseContext: opts?.baseContext || {},
    };
  }

  static get(opts?: LoggerOptions) {
    if (!Logger.instance) Logger.instance = new Logger(opts);
    else if (opts) Logger.instance.configure(opts);
    return Logger.instance;
  }

  configure(opts: LoggerOptions) {
    this.opts = { ...this.opts, ...opts, baseContext: { ...this.opts.baseContext, ...(opts.baseContext || {}) } };
  }

  child(extra: AnyObj) {
    const base = this.opts.baseContext;
    return Logger.get({ ...this.opts, baseContext: { ...base, ...extra } });
  }

  setContext(k: string, v: any) {
    this.opts.baseContext[k] = v;
  }

  private levelEnabled(level: LevelName) {
    if (level === "silent" || this.opts.level === "silent") return false;
    const cur = LEVELS[this.opts.level as Exclude<LevelName, "silent">] ?? 20;
    const want = LEVELS[level as Exclude<LevelName, "silent">] ?? 20;
    return want >= cur;
  }

  private toConsole(level: LevelName, msg: string, meta?: AnyObj) {
    const rec = { ts: iso(), level, msg, ...this.opts.baseContext, ...(meta || {}) };
    if (this.opts.prettyConsole) {
      const head = colorize(`[${rec.ts}] ${level.toUpperCase()}: ${msg}`, level, this.opts.colorConsole);
      const tail = Object.keys(meta || {}).length ? " " + safeStringify(meta, 2) : "";
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(head + tail);
    } else {
      const line = safeStringify(rec);
      const colored = colorize(line, level, this.opts.colorConsole);
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(colored);
    }
  }

  private toFile(level: LevelName, msg: string, meta?: AnyObj) {
    const rec = { ts: iso(), level, msg, ...this.opts.baseContext, ...(meta || {}) };
    const line = safeStringify(rec) + "\n";
    this.fileQueue = this.fileQueue.then(async () => {
      await ensureDir(this.opts.filePath);
      await rotateIfNeeded(this.opts.filePath, this.opts.maxSizeBytes, this.opts.maxBackups);
      await fsp.appendFile(this.opts.filePath, line, "utf8");
    }).catch((e) => {
      // si falla, al menos mostrar en consola
      console.error("[logger] file write error:", e?.message || e);
    });
  }

  private _log(level: LevelName, msg: string, meta?: AnyObj) {
    if (!this.levelEnabled(level)) return;
    const normMeta = meta && meta.error ? { ...meta, error: safeError(meta.error) } : meta;

    this.toConsole(level, msg, normMeta);
    if (this.opts.toFile) this.toFile(level, msg, normMeta);
  }

  debug(msg: string, meta?: AnyObj) { this._log("debug", msg, meta); }
  info(msg: string, meta?: AnyObj)  { this._log("info", msg, meta); }
  warn(msg: string, meta?: AnyObj)  { this._log("warn", msg, meta); }
  error(msg: string, meta?: AnyObj) { this._log("error", msg, meta); }

  // Utilidad para envolver bloques y medir tiempo
  async time<T>(label: string, fn: () => Promise<T>, meta?: AnyObj): Promise<T> {
    const t0 = Date.now();
    this.info(`${label} - start`, meta);
    try {
      const res = await fn();
      this.info(`${label} - done`, { ...meta, tookMs: Date.now() - t0 });
      return res;
    } catch (error: any) {
      this.error(`${label} - error`, { ...meta, tookMs: Date.now() - t0, error });
      throw error;
    }
  }

  // (Opcional) Reemplazar console.* por el logger
  hijackConsole() {
    const self = this;
    console.log = (...a: any[]) => self.info(a.map(String).join(" "));
    console.warn = (...a: any[]) => self.warn(a.map(String).join(" "));
    console.error = (...a: any[]) => self.error(a.map(String).join(" "));
    console.debug = (...a: any[]) => self.debug(a.map(String).join(" "));
  }
}

export default Logger;
