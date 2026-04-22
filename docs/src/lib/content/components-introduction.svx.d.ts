import type { ComponentType } from 'svelte';

type DocsSection = { id: string; title: string };
type DocsQuickLink = { title: string; description: string; href: string };

declare const component: ComponentType;
export default component;

export declare const metadata: { sections?: DocsSection[]; quickLinks?: DocsQuickLink[] };
