import { q, route } from "@ts-api-kit/core";
import { z } from "zod";

const MESSAGES = {
	en: "Hello!",
	es: "¡Hola!",
	fr: "Bonjour!",
	de: "Hallo!",
} as const;

type Locale = keyof typeof MESSAGES;

export const GET = route()
	.params(z.object({ locale: q.enum(["en", "es", "fr", "de"]).optional() }))
	.returns<{ locale: Locale; message: string }>()
	.summary("Get localized content")
	.description(
		"Returns a greeting in the requested locale — English when the segment is omitted.",
	)
	.handle(async ({ params, res }) => {
		const locale: Locale = params.locale ?? "en";
		return res({ locale, message: MESSAGES[locale] });
	});
