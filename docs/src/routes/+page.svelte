<script lang="ts">
	import { Badge } from '@/components/ui/badge/index.js';
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '@/components/ui/card/index.js';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs/index.js';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarHeader,
		SidebarInset,
		SidebarInput,
		SidebarProvider,
		SidebarRail,
		SidebarSeparator,
		SidebarTrigger
	} from '@/components/ui/sidebar/index.js';
	import ModeToggle from '@/components/docs/mode-toggle.svelte';
	import SidebarNav from '@/components/docs/sidebar-nav.svelte';
	import Content, { metadata as contentMetadata } from '../lib/content/components-introduction.svx';
	import { TOP_NAV_LINKS, SIDEBAR_SECTIONS } from '@/data/docs-navigation';
	import { cn } from '@/utils.js';
	import GithubIcon from '@lucide/svelte/icons/github';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlugIcon from '@lucide/svelte/icons/plug';

	type DocsSection = {
		id: string;
		title: string;
	};

	type DocsQuickLink = {
		title: string;
		description: string;
		href: string;
	};

	type DocsMetadata = {
		sections?: DocsSection[];
		quickLinks?: DocsQuickLink[];
	};

	const metadata = contentMetadata as DocsMetadata;

	const articleSections = metadata.sections ?? [];
	const quickLinks = metadata.quickLinks ?? [];
	const tableOfContents = articleSections.map(({ id, title }) => ({ id, title }));

	const activeSidebarHref = '#overview';

	const featureHighlights = [
		{
			title: 'File-based routing',
			description:
				'Map folders to HTTP endpoints and let the kit handle Hono, dynamic routes, and hot reload.',
			icon: LayersIcon
		},
		{
			title: 'Typed validation',
			description:
				'Use Valibot or Zod through Standard Schema and get type-safe inputs from request to response.',
			icon: CheckIcon
		},
		{
			title: 'Automatic OpenAPI',
			description:
				'Generate OpenAPI 3.1 specs with Scalar UI, dynamic placeholders, and CI friendly exports.',
			icon: PlugIcon
		}
	] satisfies { title: string; description: string; icon: typeof LayersIcon }[];

	const installTabs = [
		{ value: 'pnpm', label: 'pnpm', command: 'pnpm add @ts-api-kit/core valibot' },
		{ value: 'npm', label: 'npm', command: 'npm install @ts-api-kit/core valibot' },
		{ value: 'yarn', label: 'yarn', command: 'yarn add @ts-api-kit/core valibot' },
		{ value: 'bun', label: 'bun', command: 'bun add @ts-api-kit/core valibot' }
	] satisfies { value: string; label: string; command: string }[];

	let installTab = installTabs[0].value;
	let copiedCommand = '';

	async function copyCommand(command: string) {
		try {
			await navigator.clipboard?.writeText(command);
			copiedCommand = command;
			setTimeout(() => {
				if (copiedCommand === command) {
					copiedCommand = '';
				}
			}, 2000);
		} catch (error) {
			console.error('Failed to copy command', error);
		}
	}
</script>

<SidebarProvider class="bg-background">
	<Sidebar variant="inset" collapsible="icon" class="border-r border-border/60">
		<SidebarHeader class="gap-3">
			<div class="flex items-center gap-2 rounded-lg bg-sidebar-accent/70 p-2">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground uppercase"
				>
					ts
				</div>
				<div class="grid gap-1">
					<p class="text-sm leading-none font-semibold text-sidebar-foreground">TS API Kit</p>
					<p class="text-xs text-sidebar-foreground/70">TypeScript-first API framework</p>
				</div>
			</div>
			<Button variant="outline" size="sm" class="w-full justify-between">
				Version 0.3.0
				<ArrowRightIcon class="size-3.5" />
			</Button>
		</SidebarHeader>
		<SidebarSeparator />
		<SidebarContent class="gap-4">
			<div class="px-2">
				<SidebarInput placeholder="Search documentation" class="pr-8" />
			</div>
			<SidebarNav sections={SIDEBAR_SECTIONS} activeHref={activeSidebarHref} />
		</SidebarContent>
		<SidebarSeparator />
		<SidebarFooter>
			<Card class="border border-sidebar-border/70 bg-sidebar-accent/60">
				<CardHeader class="pb-2">
					<CardTitle class="text-sm">Want to see it live?</CardTitle>
					<CardDescription class="text-xs">
						Open the example project and inspect fully working routes.
					</CardDescription>
				</CardHeader>
				<CardContent class="flex flex-col gap-2">
					<a
						href="https://github.com/ts-api-kit/ts-api-kit/tree/main/examples/simple-example"
						target="_blank"
						rel="noreferrer"
						class={cn(buttonVariants({ size: 'sm', variant: 'secondary' }), 'gap-2')}
					>
						<SparklesIcon class="size-4" />
						Open example
					</a>
				</CardContent>
			</Card>
		</SidebarFooter>
	</Sidebar>
	<SidebarRail />
	<SidebarInset class="bg-background">
		<div class="flex min-h-svh flex-col">
			<header
				class="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70"
			>
				<div class="flex h-16 w-full items-center gap-3 px-4 sm:px-6">
					<SidebarTrigger class="md:hidden" />
					<div class="flex items-center gap-3">
						<div class="hidden items-center gap-2 md:flex">
							<div
								class="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground uppercase"
							>
								ts
							</div>
							<span class="text-sm font-semibold tracking-tight">TS API Kit</span>
						</div>
						<nav
							class="hidden items-center gap-1 text-sm font-medium text-muted-foreground lg:flex"
						>
							{#each TOP_NAV_LINKS as link}
								<a
									href={link.href}
									class="rounded-md px-3 py-1.5 transition-colors hover:bg-muted/60 hover:text-foreground"
									target={link.external ? '_blank' : undefined}
									rel={link.external ? 'noreferrer' : undefined}
								>
									{link.title}
								</a>
							{/each}
						</nav>
					</div>
					<div class="ml-auto flex items-center gap-2">
						<Button variant="outline" class="hidden items-center gap-2 text-sm lg:flex" size="sm">
							<SearchIcon class="size-4" />
							<span>Buscar nos docs...</span>
							<kbd
								class="pointer-events-none hidden rounded border border-border px-1 text-[10px] font-medium opacity-70 sm:inline-flex"
								>⌘K</kbd
							>
						</Button>
						<Button variant="ghost" size="icon" class="lg:hidden">
							<SearchIcon class="size-4" />
							<span class="sr-only">Open search</span>
						</Button>
						<a
							href="https://github.com/ts-api-kit/ts-api-kit"
							target="_blank"
							rel="noreferrer"
							class="hidden sm:flex"
						>
							<Button variant="ghost" size="icon">
								<GithubIcon class="size-4" />
								<span class="sr-only">GitHub</span>
							</Button>
						</a>
						<ModeToggle />
						<a
							href="#compiler-cli"
							class={cn(buttonVariants({ size: 'sm' }), 'hidden gap-2 sm:inline-flex')}
						>
							<SparklesIcon class="size-4" />
							CLI do compilador
						</a>
					</div>
				</div>
			</header>

			<div class="flex-1 px-4 py-10 sm:px-6 lg:px-10">
				<div class="mx-auto grid w-full max-w-6xl gap-12 xl:grid-cols-[minmax(0,1fr)_240px]">
					<article class="flex flex-col gap-12">
						<section class="space-y-6">
							<div class="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
								<Badge
									variant="outline"
									class="rounded-full border-primary/40 bg-primary/10 text-primary"
								>
									TypeScript-first framework
								</Badge>
								<span>File-based routing, schema validation, and OpenAPI with zero boilerplate.</span
								>
							</div>
							<h1
								class="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
							>
								Ship TypeScript APIs faster.
							</h1>
							<p class="max-w-2xl text-lg text-muted-foreground">
					Combine the file router, response helpers, and OpenAPI generation without giving up TypeScript control.
				</p>
							<div class="flex flex-wrap gap-3">
								<a href="#installation" class={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
									<SparklesIcon class="size-4" />
									Get started
								</a>
								<a
									href="https://github.com/ts-api-kit/ts-api-kit"
									target="_blank"
									rel="noreferrer"
									class={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
								>
									<GithubIcon class="size-4" />
									Star on GitHub
								</a>
							</div>
						</section>

						<section class="grid gap-4 md:grid-cols-3">
							{#each featureHighlights as feature}
								<Card class="border-border/70 bg-muted/20">
									<CardHeader class="flex flex-row items-center gap-3 pb-2">
										<feature.icon class="size-5 text-primary" />
										<CardTitle class="text-base font-semibold">{feature.title}</CardTitle>
									</CardHeader>
									<CardContent class="text-sm text-muted-foreground">
										{feature.description}
									</CardContent>
								</Card>
							{/each}
						</section>

						<section class="rounded-2xl border border-border/70 bg-muted/20">
							<div
								class="flex flex-col gap-2 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
							>
								<div class="space-y-1">
									<h2 class="text-lg font-semibold">Quick install</h2>
									<p class="text-sm text-muted-foreground">
										Add the core package and choose a typed validator in seconds.
									</p>
								</div>
								<a
									href="#installation"
									class={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-2')}
								>
									<SparklesIcon class="size-4" />
									View details
								</a>
							</div>
							<div class="space-y-4 px-4 py-4">
								<Tabs bind:value={installTab} class="space-y-4">
									<TabsList class="flex w-full flex-wrap gap-2 rounded-lg bg-muted/40 p-1">
										{#each installTabs as option}
											<TabsTrigger value={option.value} class="flex-1">
												{option.label}
											</TabsTrigger>
										{/each}
									</TabsList>
									{#each installTabs as option}
										<TabsContent value={option.value} class="mt-0">
											<div
												class="relative overflow-hidden rounded-lg border border-border/70 bg-background font-mono text-sm"
											>
												<button
													type="button"
													on:click={() => copyCommand(option.command)}
													class="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted"
												>
													{#if copiedCommand === option.command}
														<CheckIcon class="size-3.5" />
														Copied
													{:else}
														<CopyIcon class="size-3.5" />
														Copy
													{/if}
												</button>
												<pre class="overflow-x-auto px-4 py-5"><code>{option.command}</code></pre>
											</div>
										</TabsContent>
									{/each}
								</Tabs>
							</div>
						</section>

						<div class="docs-body">
							<Content />
						</div>

						{#if quickLinks.length}
							<section class="space-y-4">
								<h2 class="text-xl font-semibold text-foreground">Keep exploring</h2>
								<p class="text-base text-muted-foreground">
									Use these links to dive deeper into the essentials.
								</p>
								<div class="grid gap-4 md:grid-cols-3">
									{#each quickLinks as link}
										<a
											href={link.href}
											class="group flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
										>
											<div
												class="flex items-center justify-between text-sm font-medium text-foreground"
											>
												<span>{link.title}</span>
												<ArrowRightIcon
													class="size-4 transition-transform group-hover:translate-x-1"
												/>
											</div>
											<p class="text-sm leading-relaxed text-muted-foreground">
												{link.description}
											</p>
										</a>
									{/each}
								</div>
							</section>
						{/if}
					</article>

					<aside class="hidden xl:block">
						<div class="sticky top-28 rounded-xl border border-border/60 bg-muted/20 p-4">
							<p
								class="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase"
							>
								<SearchIcon class="size-3.5" />
								On this page
							</p>
							<nav class="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
								{#each tableOfContents as item}
									<a
										href={`#${item.id}`}
										class="rounded-md px-2 py-1 transition-colors hover:bg-muted/50 hover:text-foreground"
									>
										{item.title}
									</a>
								{/each}
							</nav>
						</div>
					</aside>
				</div>
			</div>
		</div>
	</SidebarInset>
</SidebarProvider>

