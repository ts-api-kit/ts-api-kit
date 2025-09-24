/**
 * Helpers to declare OpenAPI-aware responses and headers using flat exports
 * (no TypeScript namespaces), while preserving ergonomic calls like
 * `response.of<T>(meta)` and `headers.of<T>(map)`.
 */

// Response marker carries phantom type info and optional metadata for docs
export type ResponseMarker<T> = {
	readonly __brand__?: "openapi.response";
	readonly __type__?: T;
	name?: string;
	description?: string;
	contentType?: string;
	headers?: HeadersMarker<Record<string, unknown>>;
	examples?: unknown[];
	deprecated?: boolean;
} & { __phantom__: T };

// Header marker is covariant to allow specific maps to satisfy broader maps
export type HeadersMarker<T> = T & {
	readonly __brand__?: "openapi.headers";
	readonly __t__?: () => T;
};

export const responseOf = <T>(
	meta: Omit<ResponseMarker<T>, "__brand__" | "__type__" | "__phantom__"> = {},
): ResponseMarker<T> => meta as ResponseMarker<T>;

export const headersOf = <T>(v?: Partial<T>): HeadersMarker<T> =>
	(v ?? ({} as T)) as HeadersMarker<T>;

// Facades to preserve DX: response.of(...) and headers.of(...)
type ResponseFacade = Readonly<{
	of: typeof responseOf;
}>;

export const response: ResponseFacade = {
	of: responseOf,
};

type HeadersFacade = Readonly<{
	of: typeof headersOf;
}>;

export const headers: HeadersFacade = {
	of: headersOf,
};

// Canonical error object for API responses.
export type ApiError = { code: string; message: string; details?: unknown };
