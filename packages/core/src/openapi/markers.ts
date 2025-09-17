export namespace response {
	export type Marker<T> = {
		/** brand to find it in AST */
		readonly __brand__?: "openapi.response";
		/** phantom type captures T for the type checker */
		readonly __type__?: T;
		description?: string;
		contentType?: string; // default "application/json"
		// headers?: headers.Marker<any>;
		headers?: headers.Marker<any>;
		examples?: unknown[]; // optional manual examples
		deprecated?: boolean;
	} & { __phantom__: T };
	export const of = <T>(
		meta: Omit<Marker<T>, "__brand__" | "__type__" | "__phantom__"> = {},
	): Marker<T> => meta as Marker<T>;
}

export namespace headers {
	export type Marker<T> = {
		readonly __brand__?: "openapi.headers";
		readonly __t__?: (x: T) => T;
	} & T;
	export const of = <T>(v?: Partial<T>): Marker<T> => (v ?? {}) as Marker<T>;
}

// Common error shape you can reuse across routes
export type ApiError = { code: string; message: string; details?: unknown };
