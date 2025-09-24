import type { Context } from "hono";

export type ScopedErrorHandler = (
  err: unknown,
  c: Context
) => Response | Promise<Response>;
export type ScopedNotFoundHandler = (
  c: Context
) => Response | Promise<Response>;

type Entry<T> = { base: string; depth: number; handler: T };

const errorHandlers: Entry<ScopedErrorHandler>[] = [];
const notFoundHandlers: Entry<ScopedNotFoundHandler>[] = [];

function depthOf(path: string): number {
  return path.split("/").filter(Boolean).length;
}

export function registerScopedError(base: string, handler: ScopedErrorHandler): void {
  const norm = base === "" ? "/" : base;
  const depth = depthOf(norm);
  // replace existing with same base
  const idx = errorHandlers.findIndex((e) => e.base === norm);
  if (idx >= 0) errorHandlers.splice(idx, 1);
  errorHandlers.push({ base: norm, depth, handler });
  // keep deepest first for quick scan
  errorHandlers.sort((a, b) => b.depth - a.depth);
}

export function registerScopedNotFound(
  base: string,
  handler: ScopedNotFoundHandler,
): void {
  const norm = base === "" ? "/" : base;
  const depth = depthOf(norm);
  const idx = notFoundHandlers.findIndex((e) => e.base === norm);
  if (idx >= 0) notFoundHandlers.splice(idx, 1);
  notFoundHandlers.push({ base: norm, depth, handler });
  notFoundHandlers.sort((a, b) => b.depth - a.depth);
}

function matchBase(base: string, path: string): boolean {
  if (base === "/") return true;
  if (!path.startsWith(base)) return false;
  // ensure segment boundary ("/users" should not match "/userland")
  const next = path.slice(base.length, base.length + 1);
  return next === "" || next === "/";
}

export function resolveErrorForPath(path: string): ScopedErrorHandler | undefined {
  const p = path || "/";
  for (const e of errorHandlers) if (matchBase(e.base, p)) return e.handler;
  return undefined;
}

export function resolveNotFoundForPath(
  path: string,
): ScopedNotFoundHandler | undefined {
  const p = path || "/";
  for (const e of notFoundHandlers) if (matchBase(e.base, p)) return e.handler;
  return undefined;
}
