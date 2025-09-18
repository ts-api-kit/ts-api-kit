import { normalize } from "pathe";

export function isGroupSegment(seg: string): boolean {
	return seg.startsWith("(") && seg.endsWith(")");
}
export function isParamSegment(seg: string): boolean {
	return seg.startsWith("[") && seg.endsWith("]") && !seg.startsWith("[...");
}
export function isRestParamSegment(seg: string): boolean {
	return seg.startsWith("[...") && seg.endsWith("]");
}
export function segmentToPath(seg: string): string | null {
	if (isGroupSegment(seg)) return null;
	if (isRestParamSegment(seg)) return `:${seg.slice(4, -1)}*`;
	if (isParamSegment(seg)) return `:${seg.slice(1, -1)}`;
	return seg;
}
export function fsPathToRoutePath(absRoutesDir: string, absFileDir: string): string {
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
export function toArray<T>(x: T | T[] | undefined): T[] {
	if (!x) return [];
	return Array.isArray(x) ? x : [x];
}
