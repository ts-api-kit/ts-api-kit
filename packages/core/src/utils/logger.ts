/**
 * Lightweight logger with levels and namespaces for ts-api-kit
 *
 * Usage:
 *  - import { createLogger, setLogLevel } from "@ts-api-kit/core/utils";
 *  - const log = createLogger("core:file-router");
 *  - log.debug("message", data)
 *
 * Log level can be controlled by:
 *  - env TS_API_KIT_LOG or TS_API_KIT_LOG_LEVEL: silent|error|warn|info|debug
 *  - env DEBUG: enables debug when it contains "ts-api-kit" or "*"
 */

import process from "node:process";

type LevelName = "silent" | "error" | "warn" | "info" | "debug";

const LEVELS: Record<LevelName, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

let currentLevel: LevelName = inferInitialLevel();

function inferInitialLevel(): LevelName {
  const env = (process.env.TS_API_KIT_LOG_LEVEL || process.env.TS_API_KIT_LOG || "").toLowerCase();
  if (env && env in LEVELS) return env as LevelName;
  const dbg = (process.env.DEBUG || "").toLowerCase();
  if (dbg === "*" || dbg.includes("ts-api-kit")) return "debug";
  return "info";
}

export function setLogLevel(level: LevelName | string | undefined): void {
  if (!level) return;
  const key = String(level).toLowerCase();
  if (key in LEVELS) currentLevel = key as LevelName;
}

export function getLogLevel(): LevelName {
  return currentLevel;
}

function enabled(min: LevelName): boolean {
  return LEVELS[currentLevel] >= LEVELS[min];
}

function ts(): string {
  return new Date().toISOString();
}

function fmt(ns: string | undefined, msg: unknown): string {
  return ns ? `[${ns}] ${String(msg)}` : String(msg);
}

export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export function createLogger(namespace?: string): Logger {
  const ns = namespace;
  return {
    debug: (...args: unknown[]) => {
      if (!enabled("debug")) return;
      // eslint-disable-next-line no-console
      console.debug(`🐛 ${ts()} ${fmt(ns, args[0])}`, ...args.slice(1));
    },
    info: (...args: unknown[]) => {
      if (!enabled("info")) return;
      // eslint-disable-next-line no-console
      console.log(`ℹ️  ${ts()} ${fmt(ns, args[0])}`, ...args.slice(1));
    },
    warn: (...args: unknown[]) => {
      if (!enabled("warn")) return;
      // eslint-disable-next-line no-console
      console.warn(`⚠️  ${ts()} ${fmt(ns, args[0])}`, ...args.slice(1));
    },
    error: (...args: unknown[]) => {
      if (!enabled("error")) return;
      // eslint-disable-next-line no-console
      console.error(`❌ ${ts()} ${fmt(ns, args[0])}`, ...args.slice(1));
    },
  };
}

// Default logger without namespace for quick use
export const log = createLogger("ts-api-kit");

