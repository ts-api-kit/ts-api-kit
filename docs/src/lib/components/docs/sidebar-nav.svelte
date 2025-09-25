<script lang="ts">
	import {
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarMenu,
		SidebarMenuBadge,
		SidebarMenuButton,
		SidebarMenuItem
	} from '@/components/ui/sidebar/index.js';
	import type { SidebarNavSection } from '@/data/docs-navigation';

	const SidebarButton = SidebarMenuButton as typeof SidebarMenuButton & {
		$$events_def: { click: MouseEvent };
	};

	type NavItem = SidebarNavSection['items'][number];

	let {
		sections,
		activeHref = ''
	}: {
		sections: SidebarNavSection[];
		activeHref?: string;
	} = $props();

	function navigateTo(item: NavItem) {
		if (typeof window === 'undefined') return;
		if (item.external) {
			window.open(item.href, '_blank', 'noreferrer');
			return;
		}
		window.location.href = item.href;
	}
</script>

{#each sections as section}
	<SidebarGroup>
		<SidebarGroupLabel>{section.title}</SidebarGroupLabel>
		<SidebarGroupContent>
			<SidebarMenu>
				{#each section.items as item}
					<SidebarMenuItem>
						<SidebarButton isActive={item.href === activeHref} on:click={() => navigateTo(item)}>
							<span class="truncate">{item.title}</span>
							{#if item.badge}
								<SidebarMenuBadge class="uppercase">{item.badge}</SidebarMenuBadge>
							{/if}
						</SidebarButton>
					</SidebarMenuItem>
				{/each}
			</SidebarMenu>
		</SidebarGroupContent>
	</SidebarGroup>
{/each}
