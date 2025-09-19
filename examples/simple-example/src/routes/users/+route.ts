import { response } from "@ts-api-kit/core/openapi";
import { handle } from "@ts-api-kit/core/server";
import * as v from "valibot";

interface User {
	id: string;
	name: string;
	email: string;
}

type UsersListResponse = {
	/**
	 * @description List of users
	 * @example [{ id: 1, name: "Ada", email: "ada@lovelace.io" }]
	 */
	items: User[];
	/**
	 * @description Page number
	 * @example 1
	 */
	page: number;
	/**
	 * @description Items per page
	 * @example 20
	 */
	pageSize: number;
	/**
	 * @description Total number of items
	 * @example 100
	 */
	total?: number;
};

const items: User[] = [
	{ id: crypto.randomUUID(), name: "Ada", email: "ada@lovelace.io" },
	{ id: crypto.randomUUID(), name: "Alan", email: "alan@turing.io" },
	{ id: crypto.randomUUID(), name: "Grace", email: "grace@hopper.io" },
	{ id: crypto.randomUUID(), name: "Marie", email: "marie@curie.io" },
	{ id: crypto.randomUUID(), name: "Nikola", email: "nikola@tesla.io" },
	{ id: crypto.randomUUID(), name: "Richard", email: "richard@feynman.io" },
	{ id: crypto.randomUUID(), name: "Thomas", email: "thomas@edison.io" },
	{ id: crypto.randomUUID(), name: "Albert", email: "albert@einstein.io" },
	{ id: crypto.randomUUID(), name: "Isaac", email: "isaac@newton.io" },
];

/**
 * @summary List users
 * @description Paginated user listing with automatic OpenAPI generation.
 * @tags users
 */
export const GET = handle(
	{
		openapi: {
			request: {
				query: v.object({
					/**
					 * @example 1
					 * @description Page number (1-based)
					 */
					page: v.pipe(v.string(), v.transform(Number), v.number()),
					/**
					 * @example 20
					 * @description Items per page
					 */
					pageSize: v.optional(v.pipe(v.string(), v.transform(Number))),
				}),
			},
			responses: {
				200: response.of<UsersListResponse>({ description: "OK" }),
				404: response.of<{ error: string }>({ description: "Not Found" }),
			},
		},
	},
	async ({ query, response }) => {
		const { pageSize = 20, page = 1 } = query;
		return response.ok({ items, page, pageSize, total: items.length });
	},
);

/**
 * @summary Create user
 * @description Create a user
 * @tags users
 */
export const POST = handle(
	{
		openapi: {
			request: {
				/**
				 * @description Body of the request
				 * @example { name: "John Doe", email: "john.doe@example.com" }
				 */
				body: v.object({
					/**
					 * @description Name of the user
					 * @example "John Doe"
					 */
					name: v.string(),
					/**
					 * @description Email of the user
					 * @example "john.doe@example.com"
					 */
					email: v.string(),
				}),
			},
			responses: {
				200: response.of<User>({ description: "OK" }),
			},
		},
	},
	async ({ body, response }) => {
		const newItem = { id: crypto.randomUUID(), ...body };
		items.push(newItem);
		return response.ok(newItem);
	},
);

/**
 * @summary Update user
 * @description Update a user
 * @tags users
 */
export const PUT = handle(
	{
		openapi: {
			request: {
				body: v.object({
					id: v.string(),
					name: v.string(),
					email: v.string(),
				}),
			},
			responses: {
				200: response.of<boolean>({ description: "OK" }),
				404: response.of<{ error: string }>({ description: "Not Found" }),
			},
		},
	},
	async ({ body, response }) => {
		const itemIndex = items.findIndex((item) => item.id === body.id);
		if (itemIndex === -1) {
			return response.json({ error: "Item not found" }, { status: 404 });
		}

		items.splice(itemIndex, 1, { ...items[itemIndex], ...body });

		return response.ok(true);
	},
);

/**
 * @summary Delete users
 * @description Delete a users
 * @tags users
 */
export const DELETE = handle(
	{
		openapi: {
			request: {
				body: v.object({
					/**
					 * @description IDs of the users to delete
					 * @example [1, 2, 3]
					 */
					ids: v.array(v.string()),
				}),
			},
			responses: {
				200: response.of<boolean>({ description: "OK" }),
				404: response.of<{ error: string }>({ description: "Not Found" }),
			},
		},
	},
	async ({ body, response }) => {
		const { ids } = body;
		const indexes = ids.map((id) => items.findIndex((item) => item.id === id));

		if (indexes.some((index) => index === -1)) {
			return response.json({ error: "Item not found" }, { status: 404 });
		}

		indexes.forEach((index) => {
			items.splice(index, 1);
		});

		return response.json(true);
	},
);
