<script lang="ts">
	import type { LayoutProps } from './$types';
	import { page } from '$app/state';
	import Nav from '$lib/presentation/component/nav.svelte';
	import Palette from '@lucide/svelte/icons/palette';
	import Dices from '@lucide/svelte/icons/dices';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Menu from '@lucide/svelte/icons/menu';
	import * as DropdownMenu from '$lib/presentation/component/ui/dropdown-menu';
	import * as m from '$lib/paraglide/messages.js';
	import type { ThemeName } from '$lib/business/store/theme-store.svelte';
	import Footer from '$lib/presentation/component/footer.svelte';
	import { setSessionStore } from '$lib/business/store/session-store.svelte';
	import { getThemeStore } from '$lib/business/store/theme-store.svelte';
	import * as backup from '$lib/business/backup';

	let { children }: LayoutProps = $props();

	const themeStore = getThemeStore();

	let backupFileInput: HTMLInputElement | undefined = $state();

	async function exportData() {
		const file = await backup.$exportAllStores();
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(file, null, '\t')], { type: 'application/json' })
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `fallow-backup-${file.exportedAt.slice(0, 10)}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	async function importData(file: File) {
		try {
			await backup.$importAllStores(JSON.parse(await file.text()));
		} catch {
			alert(m.backup_import_failed());
			return;
		}
		// Stores read IndexedDB once on mount — reload so they pick up the
		// imported records.
		location.reload();
	}

	async function deleteData() {
		if (!confirm(m.data_delete_confirm())) return;
		await backup.$deleteAllStores();
		location.reload();
	}

	// The shared daily session (tasks, budget, pools + persistence) lives in
	// context, created per component tree — never at module scope, so nothing
	// can leak across SSR requests. Pages grab it with getSessionStore().
	setSessionStore();

	// Calendar is the one full-viewport page: it must never scroll, so its grid
	// rows split the leftover height instead of growing the page.
	const fullViewport = $derived(page.route.id?.endsWith('/calendar') ?? false);
</script>

<main
	class="text-ty-secondary antialiased selection:bg-success/30 selection:text-success-strong font-sans flex flex-col
	       {fullViewport ? 'h-dvh overflow-hidden' : 'min-h-screen'}"
>
	<div class=" mx-auto w-full max-w-7xl px-page-sm py-page sm:px-page-md lg:px-page flex min-h-0 flex-1 flex-col">
		<Nav>
			{#snippet actions()}
				<div class="flex items-center gap-grid-xs">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger variant="pill" aria-label={m.nav_switch_theme()}>
							<Palette class="h-4 w-4 shrink-0" />
							<span class="hidden sm:inline">{themeStore.label}</span>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="nice-scrollbar w-max min-w-40 max-h-[min(80vh,40rem)] overflow-y-auto">
							<DropdownMenu.RadioGroup
								value={themeStore.theme}
								onValueChange={(v) => themeStore.switchTheme(v as ThemeName)}
							>
								{#each themeStore.themes as theme (theme.name)}
									<DropdownMenu.RadioItem value={theme.name} class="cursor-pointer gap-grid-xs">
										<!-- theme classes scope that theme's CSS vars to the swatch,
										     so the slices always match layout.css -->
										<span
											class="{theme.css.join(' ')} border-line-strong flex h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full border"
											aria-hidden="true"
										>
											<span class="h-full w-1/2" style="background: var(--surface-page)"></span>
											<span class="h-full w-1/2" style="background: var(--primary)"></span>
										</span>
										{theme.label}
									</DropdownMenu.RadioItem>
								{/each}
							</DropdownMenu.RadioGroup>
							<DropdownMenu.Separator />
							<!-- stays open so the new arrangement can be judged and rerolled -->
							<DropdownMenu.Item
								class="cursor-pointer gap-grid-xs"
								closeOnSelect={false}
								onclick={() => themeStore.rerollScenery()}
							>
								<Dices class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
								{m.theme_reroll_scenery()}
							</DropdownMenu.Item>
							<DropdownMenu.Item
								class="cursor-pointer gap-grid-xs"
								closeOnSelect={false}
								onclick={() => themeStore.toggleSceneryMotion()}
							>
								{#if themeStore.sceneryPaused}
									<Play class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
									{m.theme_resume_animations()}
								{:else}
									<Pause class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
									{m.theme_pause_animations()}
								{/if}
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger variant="pill" aria-label={m.header_data_menu()}>
							<Menu class="h-4 w-4 shrink-0" />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-48">
							<DropdownMenu.Item onclick={exportData}>{m.data_export()}</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => backupFileInput?.click()}>
								{m.data_import()}
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item variant="destructive" onclick={deleteData}>
								{m.data_delete()}
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
					<input
						bind:this={backupFileInput}
						type="file"
						accept="application/json,.json"
						class="hidden"
						onchange={(event) => {
							const file = event.currentTarget.files?.[0];
							if (file) importData(file);
							event.currentTarget.value = '';
						}}
					/>
				</div>
			{/snippet}
		</Nav>
		{@render children()}
		<Footer />
	</div>
</main>
