import type { DirConfig } from "@ts-api-kit/core";

export default {
	// Reject bodies larger than 1MB using Content-Length
	body: { limit: 1_048_576 },
	// Soft timeout (milliseconds). Returns 504 if exceeded.
	timeout: { ms: 5_000 },
	// Enable permissive CORS for demo purposes
	cors: {
		origin: "*",
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	},
	// Demo: no auth required globally
	auth: false,
	// Rate-limit headers only (no enforcement) – hints for clients/proxies
	rateLimit: { windowMs: 60_000, max: 600, policy: "600;w=60" },
} satisfies DirConfig;
