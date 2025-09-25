<script lang="ts">
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuLabel,
		DropdownMenuSeparator,
		DropdownMenuTrigger
	} from '@/components/ui/dropdown-menu/index.js';
	import { mode, setMode } from 'mode-watcher';
	import { Check, Monitor, Moon, Sun } from '@lucide/svelte';

	const DropdownItem = DropdownMenuItem as typeof DropdownMenuItem & {
		$$events_def: { select: CustomEvent<void> };
	};

	type ThemeOption = {
		value: 'light' | 'dark' | 'system';
		label: string;
		icon: typeof Sun;
	};

	const options: ThemeOption[] = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];

	const currentMode = $derived(mode.current ?? 'system');

	function handleSelect(value: ThemeOption['value']) {
		setMode(value);
	}
</script>

<DropdownMenu>
	<DropdownMenuTrigger
		class="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
		aria-label="Toggle theme"
	>
		<Sun class="size-[18px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
		<Moon
			class="absolute size-[18px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0"
		/>
		<span class="sr-only">Toggle theme</span>
	</DropdownMenuTrigger>
	<DropdownMenuContent align="end" class="w-44">
		<DropdownMenuLabel>Theme</DropdownMenuLabel>
		<DropdownMenuSeparator />
		{#each options as option}
			<!-- @ts-expect-error bits-ui doesn't expose select event typings -->
			<DropdownItem on:select={() => handleSelect(option.value)}>
				<option.icon class="size-4" />
				<span class="flex-1 text-sm">{option.label}</span>
				{#if currentMode === option.value}
					<Check class="size-4" />
				{/if}
			</DropdownItem>
		{/each}
	</DropdownMenuContent>
</DropdownMenu>
