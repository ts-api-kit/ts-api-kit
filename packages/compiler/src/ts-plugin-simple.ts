import type * as ts from "typescript";
import { createOpenAPIPlugin } from "./plugin.ts";

// Simple plugin that can be used with ts-node
export default function (program: ts.Program): void {
	const plugin = createOpenAPIPlugin({
		outputFile: "openapi.json",
		title: "Simple Example API",
		version: "1.0.0",
		description: "Generated from TypeScript routes",
	});

	plugin(program);
}
