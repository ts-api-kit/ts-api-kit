import fs from "node:fs";

export type RouteJSDocOA = {
	summary?: string;
	description?: string;
	tags?: string[];
	security?: any[];
	deprecated?: boolean;
	operationId?: string;
	externalDocs?: { url: string; description?: string };
	// Opcionalmente, você pode suportar @path e @method override (não recomendado):
	path?: string;
	method?: string;
};

export type ParameterJSDoc = {
	description?: string;
	example?: string;
};

/** Lê o bloco JSDoc que precede `export const|function <ExportName>` */
export function readRouteJSDocForExport(
	filePath: string,
	exportName: string,
): RouteJSDocOA {
	try {
		const src = fs.readFileSync(filePath, "utf8");
		const re = new RegExp(
			String.raw`/\*\*([\s\S]*?)\*/\s*export\s+(?:const|async\s+function|function)\s+${exportName}\b`,
			"m",
		);
		const m = src.match(re);
		if (!m) return {};
		return parseJSDocBlock(m[1]);
	} catch {
		return {};
	}
}

function parseJSDocBlock(block: string): RouteJSDocOA {
	const lines = block.split(/\r?\n/).map((l) => l.replace(/^\s*\*\s?/, ""));

	const out: RouteJSDocOA = {};

	// Helper p/ coletar bloco multi-linha após um tag até o próximo @tag
	const collectMultiline = (startIdx: number, firstLineRemainder: string) => {
		let text = firstLineRemainder.trim();
		let i = startIdx + 1;
		while (i < lines.length && !/^@/.test(lines[i].trim())) {
			text += (text ? "\n" : "") + lines[i].replace(/^\s*\*\s?/, "");
			i++;
		}
		return { text: text.trim(), end: i - 1 };
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		if (line.startsWith("@summary ")) out.summary = line.slice(9).trim();
		else if (line.startsWith("@description")) {
			const rest = line.replace("@description", "");
			const { text, end } = collectMultiline(i, rest);
			out.description = text;
			i = end;
		} else if (line.startsWith("@tags")) {
			const rest = line.replace("@tags", "").trim();
			// Suporta vírgula ou espaço; múltiplos @tags acumulam
			const tags = rest
				? rest
						.split(/[,\s]+/)
						.map((s) => s.trim())
						.filter(Boolean)
				: [];
			out.tags = [...(out.tags ?? []), ...tags];
			out.tags = Array.from(new Set(out.tags));
		} else if (line.startsWith("@deprecated")) {
			out.deprecated = true;
		} else if (line.startsWith("@security")) {
			// Espera JSON inline (ex.: @security [{"bearerAuth":[]}])
			const json = line.replace("@security", "").trim();
			if (json) {
				try {
					const v = JSON.parse(json);
					if (Array.isArray(v)) out.security = v;
					else out.security = [v];
				} catch {}
			} else {
				out.security = [{}];
			}
		} else if (line.startsWith("@operationId")) {
			out.operationId = line.replace("@operationId", "").trim();
		} else if (line.startsWith("@externalDocs")) {
			const rest = line.replace("@externalDocs", "").trim();
			try {
				const v = JSON.parse(rest);
				if (v && typeof v === "object" && "url" in v) out.externalDocs = v;
			} catch {}
		} else if (line.startsWith("@path")) {
			out.path = line.replace("@path", "").trim();
		} else if (line.startsWith("@method")) {
			out.method = line.replace("@method", "").trim().toLowerCase();
		}
	}

	return out;
}

/** Lê JSDoc de um parâmetro específico dentro de um objeto Valibot */
export function readParameterJSDoc(
	filePath: string,
	parameterName: string,
): ParameterJSDoc {
	try {
		const src = fs.readFileSync(filePath, "utf8");

		// Procura por JSDoc que precede a definição do parâmetro
		// Padrão: /** ... */ parameterName: v.schema()
		const re = new RegExp(
			String.raw`/\*\*([\s\S]*?)\*/\s*${parameterName}\s*:`,
			"m",
		);
		const m = src.match(re);
		if (!m) return {};

		return parseParameterJSDocBlock(m[1]);
	} catch {
		return {};
	}
}

function parseParameterJSDocBlock(block: string): ParameterJSDoc {
	const lines = block.split(/\r?\n/).map((l) => l.replace(/^\s*\*\s?/, ""));

	const out: ParameterJSDoc = {};

	// Helper para coletar bloco multi-linha após um tag até o próximo @tag
	const collectMultiline = (startIdx: number, firstLineRemainder: string) => {
		let text = firstLineRemainder.trim();
		let i = startIdx + 1;
		while (i < lines.length && !/^@/.test(lines[i].trim())) {
			text += (text ? "\n" : "") + lines[i].replace(/^\s*\*\s?/, "");
			i++;
		}
		return { text: text.trim(), end: i - 1 };
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		if (line.startsWith("@description")) {
			const rest = line.replace("@description", "");
			const { text, end } = collectMultiline(i, rest);
			out.description = text;
			i = end;
		} else if (line.startsWith("@example")) {
			out.example = line.replace("@example", "").trim();
		} else if (!line.startsWith("@")) {
			// Se não começa com @, é descrição livre
			if (!out.description) {
				const { text, end } = collectMultiline(i, line);
				out.description = text;
				i = end;
			}
		}
	}

	return out;
}
