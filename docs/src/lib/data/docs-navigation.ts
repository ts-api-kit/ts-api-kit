export type TopNavLink = {
	title: string;
	href: string;
	external?: boolean;
};

export type SidebarNavItem = {
	title: string;
	href: string;
	external?: boolean;
	badge?: string;
};

export type SidebarNavSection = {
	title: string;
	items: SidebarNavItem[];
};

export const TOP_NAV_LINKS: TopNavLink[] = [
	{ title: 'Overview', href: '#overview' },
	{ title: 'Fundamentals', href: '#routing' },
	{ title: 'OpenAPI', href: '#openapi' },
	{ title: 'Tooling', href: '#compiler-cli' },
	{ title: 'GitHub', href: 'https://github.com/ts-api-kit/ts-api-kit', external: true }
];

export const SIDEBAR_SECTIONS: SidebarNavSection[] = [
	{
		title: 'Quick start',
		items: [
			{ title: 'Overview', href: '#overview' },
			{ title: 'Installation', href: '#installation' },
			{ title: 'First route', href: '#first-route' },
			{ title: 'Project structure', href: '#project-structure' }
		]
	},
	{
		title: 'Fundamentals',
		items: [
			{ title: 'Routing', href: '#routing' },
			{ title: 'Handlers & context', href: '#handlers-context' },
			{ title: 'Validation', href: '#validation' },
			{ title: 'Typed responses', href: '#responses' },
			{ title: 'Middlewares', href: '#middlewares' },
			{ title: 'Errors & 404', href: '#scoped-handlers' }
		]
	},
	{
		title: 'OpenAPI & tooling',
		items: [
			{ title: 'Metadata', href: '#openapi' },
			{ title: 'response.of & headers', href: '#response-markers' },
			{ title: 'Compiler CLI', href: '#compiler-cli' },
			{ title: 'Compiler config', href: '#compiler-config' },
			{ title: 'Node loader', href: '#node-loader' }
		]
	},
	{
		title: 'Practical guide',
		items: [
			{ title: 'Auth & security', href: '#auth' },
			{ title: 'Error handling', href: '#error-handling' },
			{ title: 'Logging & DX', href: '#logging' },
			{ title: 'Deploy & runtime', href: '#deploy' }
		]
	},
	{
		title: 'Resources',
		items: [
			{ title: 'Examples', href: 'https://github.com/ts-api-kit/ts-api-kit/tree/main/examples', external: true },
			{ title: 'API reference', href: 'https://jsr.io/@ts-api-kit/core', external: true },
			{ title: 'Discussions', href: 'https://github.com/ts-api-kit/ts-api-kit/discussions', external: true }
		]
	}
];
