import type * as ts from "typescript";
import { createOpenAPIPlugin } from "./plugin.ts";

/**
 * Minimal TypeScript plugin entrypoint used for quick prototyping scenarios.
 *
 * @param program - TypeScript program provided by the compiler host
 */
export default function (program: ts.Program): void {
	const plugin = createOpenAPIPlugin({
		outputFile: "openapi.json",
		title: "Simple Example API",
		version: "1.0.0",
		description: "Generated from TypeScript routes",
	});

	plugin(program);
}
