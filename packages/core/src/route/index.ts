// Public surface of the RFC route builder. Side-by-side with the
// legacy `handle()` API — both work until the breaking-change release.

export {
	type RouteBuilder,
	type RouteHandlerContext,
	route,
} from "./builder.ts";
export { q, type TypeMarker, type TypeMeta } from "./q.ts";
