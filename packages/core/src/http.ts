export type HttpMethod =
	| "get"
	| "post"
	| "put"
	| "patch"
	| "delete"
	| "options"
	| "head";

export type HttpRoute<
	P = unknown, // params (path)
	Q = unknown, // querystring
	H = unknown, // headers
	B = unknown, // request body
	R extends Record<number, unknown> = Record<number, unknown>, // responses por status
> = {
	/** Ex.: "/users/{id}" — use chaves para path params */
	path: string;
	method: HttpMethod;
	summary?: string;
	description?: string;
	tags?: string[];
	request?: {
		params?: P;
		query?: Q;
		headers?: H;
		body?: B;
		/** MIME do corpo de entrada (default: application/json) */
		contentType?: string;
	};
	/** Map de status → tipo do corpo de resposta */
	responses: R;
	/** MIME das respostas (default: application/json) */
	responseContentType?: string;
};
