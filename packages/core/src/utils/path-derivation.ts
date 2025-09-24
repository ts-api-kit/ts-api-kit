// Path derivation utility for file-based routing
/**
 * Pair of route patterns derived from a file path.
 * - `hono` uses Hono syntax (e.g. `/users/:id`)
 * - `openapi` uses OpenAPI syntax (e.g. `/users/{id}`)
 */
export type DerivedPaths = { hono: string; openapi: string };

const FILE_RE = /(\+?route\.(?:t|j)sx?)$/; // +route.ts, route.ts, +route.tsx, etc.

/**
 * Converts a file path to paths for Hono and OpenAPI.
 * Examples:
 *   routes/users/[id]/+route.ts        → { hono: '/users/:id', openapi: '/users/{id}' }
 *   routes/blog/[...slug]/route.ts     → { hono: '/blog/:slug{.*}', openapi: '/blog/{slug}' }
 *   routes/[[locale]]/+route.ts        → { hono: '/:locale', openapi: '/{locale}' }
 *   routes/users/[id([0-9]+)]/+route.ts → { hono: '/users/:id([0-9]+)', openapi: '/users/{id}' }
 *   routes/(grp)/index/+route.ts       → { hono: '/', openapi: '/' }
 */
export function derivePathsFromFile(absOrRelFile: string): DerivedPaths {
	// normalize separators
	let p = absOrRelFile.replace(/\\/g, "/");

	// cut everything up to 'routes/' if it exists
	const anchor = "/routes/";
	const idx = p.lastIndexOf(anchor);
	if (idx >= 0) p = p.slice(idx + anchor.length);

	// remove file suffix (+route.ts, route.ts, ...)
	p = p.replace(FILE_RE, "");

	// normalise trailing slash then remove optional trailing /index
	if (p.endsWith("/")) p = p.slice(0, -1);
	p = p.replace(/\/index$/, "");

	// base path
	if (p === "" || p === "/") return { hono: "/", openapi: "/" };

	const rawSegs = p.split("/").filter(Boolean);

	const honoSegs: string[] = [];
	const oaSegs: string[] = [];

	for (const seg of rawSegs) {
		// ignore groups (e.g., (admin))
		if (seg.startsWith("(") && seg.endsWith(")")) continue;

		// catch-all: [...slug]
		const mCatch = seg.match(/^\[\.+\.\.\.(.+)\]$/);
		if (mCatch) {
			const name = mCatch[1];
			honoSegs.push(`:${name}{.*}`);
			oaSegs.push(`{${name}}`);
			continue;
		}

		// optional catch-all: [[...slug]]
		const mOptCatch = seg.match(/^\[\[\.+\.\.\.(.+)\]\]$/);
		if (mOptCatch) {
			const name = mOptCatch[1];
			honoSegs.push(`:${name}{.*}`);
			oaSegs.push(`{${name}}`);
			continue;
		}

		// optional dynamic: [[locale]] or [[id]]
		const mOptDyn = seg.match(/^\[\[(.+)\]\]$/);
		if (mOptDyn) {
			const name = mOptDyn[1];
			honoSegs.push(`:${name}`);
			oaSegs.push(`{${name}}`);
			continue;
		}

		// dynamic with regex: [id(\\d+)] or [slug([a-z-]+)]
		const mDynRegex = seg.match(/^\[(.+)\((.+)\)\]$/);
		if (mDynRegex) {
			const name = mDynRegex[1];
			const regex = mDynRegex[2];
			honoSegs.push(`:${name}(${regex})`);
			oaSegs.push(`{${name}}`);
			continue;
		}

		// optional dynamic with regex: [[id([0-9]+)]]
		const mOptDynRegex = seg.match(/^\[\[(.+)\((.+)\)\]\]$/);
		if (mOptDynRegex) {
			const name = mOptDynRegex[1];
			const regex = mOptDynRegex[2];
			honoSegs.push(`:${name}(${regex})`);
			oaSegs.push(`{${name}}`);
			continue;
		}

		// dynamic: [id]
		const mDyn = seg.match(/^\[(.+)\]$/);
		if (mDyn) {
			const name = mDyn[1];
			honoSegs.push(`:${name}`);
			oaSegs.push(`{${name}}`);
			continue;
		}

		// static
		honoSegs.push(seg);
		oaSegs.push(seg);
	}

	const hono = `/${honoSegs.join("/")}`;
	const openapi = `/${oaSegs.join("/")}`;
	return {
		hono: hono === "//" ? "/" : hono,
		openapi: openapi === "//" ? "/" : openapi,
	};
}
