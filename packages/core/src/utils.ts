import { normalize } from "pathe";

/**
 * Checks whether a file-system segment represents a group folder `(group)`.
 */
export function isGroupSegment(seg: string): boolean {
	return seg.startsWith("(") && seg.endsWith(")");
}
/**
 * Detects dynamic parameter segments such as `[id]`.
 */
export function isParamSegment(seg: string): boolean {
	return seg.startsWith("[") && seg.endsWith("]") && !seg.startsWith("[...");
}
/**
 * Detects rest parameter segments such as `[...slug]`.
 */
export function isRestParamSegment(seg: string): boolean {
	return seg.startsWith("[...") && seg.endsWith("]");
}
/**
 * Converts a file-system segment into a route fragment understood by Hono.
 *
 * @param seg - Segment from the routes directory path
 * @returns Converted segment (`:id`, `:slug*`, literal) or null when grouped
 */
export function segmentToPath(seg: string): string | null {
	if (isGroupSegment(seg)) return null;
	if (isRestParamSegment(seg)) return `:${seg.slice(4, -1)}*`;
	if (isParamSegment(seg)) return `:${seg.slice(1, -1)}`;
	return seg;
}
/**
 * Builds the Hono-style path for a given file relative to the routes root.
 *
 * @param absRoutesDir - Absolute path to the routes directory
 * @param absFileDir - Absolute path to the route file
 * @returns The resolved request path (e.g. `/users/:id`)
 */
export function fsPathToRoutePath(
	absRoutesDir: string,
	absFileDir: string,
): string {
	const rel = normalize(absFileDir).slice(normalize(absRoutesDir).length);
	const raw = rel.split("/").filter(Boolean);
	const urlSegs: string[] = [];
	for (const seg of raw) {
		const part = segmentToPath(seg);
		if (part === null) continue;
		urlSegs.push(part);
	}
	const path = `/${urlSegs.filter(Boolean).join("/")}`;
	return path === "/" ? "/" : path;
}
/**
 * Normalises a value to an array, filtering out `undefined` inputs.
 */
export function toArray<T>(x: T | T[] | undefined): T[] {
	if (!x) return [];
	return Array.isArray(x) ? x : [x];
}
