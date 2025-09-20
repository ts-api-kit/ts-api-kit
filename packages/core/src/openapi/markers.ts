/**
 * Helpers to declare OpenAPI-aware responses at the type level.
 *
 * Response markers carry a phantom type to encode the response body shape and
 * optional metadata such as description, examples and content type.
 */
export namespace response {
    /**
     * Phantom type marker describing the response shape and metadata.
     */
    export type Marker<T> = {
        /** Brand used by tooling to detect response markers. */
        readonly __brand__?: "openapi.response";
        /** Phantom type that captures the payload type. */
        readonly __type__?: T;
        /** Preferred schema component name for this body. */
        name?: string;
        /** Human-readable response description. */
        description?: string;
        /** MIME type for the response body (default: application/json). */
        contentType?: string;
        /** Optional response headers typed via {@link headers.Marker}. */
        headers?: headers.Marker<Record<string, unknown>>;
        /** Optional example payloads. */
        examples?: unknown[];
        /** Marks the response as deprecated in docs. */
        deprecated?: boolean;
    } & { __phantom__: T };
    /**
     * Creates a response marker from metadata. The generic argument `T`
     * describes the response body type for the given status.
     */
    export const of = <T>(
        meta: Omit<Marker<T>, "__brand__" | "__type__" | "__phantom__"> = {},
    ): Marker<T> => meta as Marker<T>;
}

/**
 * Helpers to declare typed response headers.
 */
export namespace headers {
    /**
     * Phantom type wrapper to encode a headers map type for documentation.
     */
    export type Marker<T> = {
        readonly __brand__?: "openapi.headers";
        readonly __t__?: (x: T) => T;
    } & T;
    /**
     * Builds a header marker from a partial value.
     */
    export const of = <T>(v?: Partial<T>): Marker<T> => (v ?? {}) as Marker<T>;
}

/**
 * Canonical error object for API responses.
 */
export type ApiError = { code: string; message: string; details?: unknown };
