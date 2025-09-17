// Path derivation utility for file-based routing
export type DerivedPaths = { hono: string; openapi: string };

const FILE_RE = /(\+?route\.(?:t|j)sx?)$/; // +route.ts, route.ts, +route.tsx, etc.

/**
 * Converts a file path to paths for Hono and OpenAPI.
 * Examples:
 *   routes/users/[id]/+route.ts    → { hono: '/users/:id', openapi: '/users/{id}' }
 *   routes/blog/[...slug]/route.ts → { hono: '/blog/:slug{.*}', openapi: '/blog/{slug}' }
 *   routes/(grp)/index/+route.ts   → { hono: '/',             openapi: '/' }
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

	// remove /index at the end
	p = p.replace(/\/index$/, "");

	// base path
	if (p === "" || p === "/") return { hono: "/", openapi: "/" };

	const rawSegs = p.split("/").filter(Boolean);

	const honoSegs: string[] = [];
	const oaSegs: string[] = [];

	for (const seg of rawSegs) {
		// ignore groups (e.g., (admin))
		if (seg.startsWith("(") && seg.endsWith(")")) continue;

		// catch-all: [...slug] or [[...slug]]
		const mCatch =
			seg.match(/^\[\.+\.\.\.(.+)\]$/) || seg.match(/^\[\[\.+\.\.\.(.+)\]\]$/);
		if (mCatch) {
			const name = mCatch[1];
			honoSegs.push(`:${name}{.*}`);
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
