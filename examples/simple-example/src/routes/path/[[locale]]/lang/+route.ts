import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

export const GET = route()
	.params(z.object({ locale: q.str().optional() }))
	.returns<{ lang: string }>()
	.summary("Get current language segment")
	.handle(async ({ params, res }) => res({ lang: params.locale ?? "en" }));
