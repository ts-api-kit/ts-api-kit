import type { Context, MiddlewareHandler, Next } from "hono";

export type KitContext = Context;
export type KitNext = Next;

/**
 * Define one or more middlewares in a Hono-agnostic way.
 *
 * Example usage in a `+middleware.ts` file:
 *   import { defineMiddleware } from "@ts-api-kit/core";
 *   export const middleware = defineMiddleware(async (c, next) => {
 *     // your logic here
 *     await next();
 *   });
 */
export function defineMiddleware(
  ...mws: MiddlewareHandler[]
): MiddlewareHandler[] {
  return mws;
}

/**
 * Alias ergonômico para definir middlewares, mantendo simetria com `handle`.
 *
 * Exemplo:
 *   export const USE = use(logger(), auth())
 */
export const use = defineMiddleware;

export type NotFoundHandlerFn = (c: Context) => Response | Promise<Response>;

export const handleNotFound = (handler: NotFoundHandlerFn) => {
  return (c: Context) => {
    return handler(c);
  };
};

export type ErrorHandlerFn = (err: unknown, c: Context) => Response | Promise<Response>;

export const handleError = (handler: ErrorHandlerFn) => {
  return (err: unknown, c: Context) => {
    return handler(err, c);
  };
};

/**
 * Small helper to compose multiple middleware functions.
 */
export const composeMiddleware = (
  ...mws: MiddlewareHandler[]
): MiddlewareHandler[] => mws;

/**
 * Convenience factory: basic request logger middleware.
 */
export function createLoggerMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    const { method } = c.req;
    const url = new URL(c.req.url);
    const status = c.res?.status ?? 0;
    // eslint-disable-next-line no-console
    console.log(`${method} ${url.pathname} -> ${status} (${duration}ms)`);
  };
}
