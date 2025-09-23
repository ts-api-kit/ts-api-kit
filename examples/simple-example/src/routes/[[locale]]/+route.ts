import { handle, json, response } from "@ts-api-kit/core";
import * as v from "valibot";

/**
 * @openapi
 * /{locale}:
 *   get:
 *     summary: Get localized content
 *     description: Returns content for the specified locale (optional)
 *     parameters:
 *       - name: locale
 *         in: path
 *         required: false
 *         schema:
 *           type: string
 *           enum: [en, es, fr, de]
 *     responses:
 *       200:
 *         description: Localized content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 locale:
 *                   type: string
 *                 message:
 *                   type: string
 */
export const GET = handle(
  {
    openapi: {
      request: {
        params: v.object({
          locale: v.optional(v.string()),
        }),
      },
      responses: {
        200: response.of<{ locale: string; message: string }>(),
      },
    },
  },
  ({ params }) => {
    const locale = params.locale || "en";
    
    const messages = {
      en: "Hello!",
      es: "¡Hola!",
      fr: "Bonjour!",
      de: "Hallo!"
    };

    return json({
      locale,
      message: messages[locale as keyof typeof messages] || messages.en
    });
  }
);
