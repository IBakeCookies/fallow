<script lang="ts">
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { localizeHref } from '$lib/paraglide/runtime';
	import { logError } from '$lib/logger';
	import Nav from '$lib/presentation/component/nav.svelte';
	import Palette from '@lucide/svelte/icons/palette';
	import Dices from '@lucide/svelte/icons/dices';
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import * as DropdownMenu from '$lib/presentation/component/ui/dropdown-menu';
	import { Toaster } from '$lib/presentation/component/ui/sonner';
	import * as m from '$lib/paraglide/messages.js';
	import type { ThemeName } from '$lib/business/model/theme';
	import Footer from '$lib/presentation/component/footer.svelte';
	import { setStorageStatusStore } from '$lib/business/store/storage-status.svelte';
	import { setSessionStore } from '$lib/business/store/session-store.svelte';
	import { setEnergyObservationStore } from '$lib/business/store/energy-observation-store.svelte';
	import { setEnergyLabStore } from '$lib/business/store/energy-lab-store.svelte';
	import { setSessionTimerStore } from '$lib/business/store/session-timer-store.svelte';
	import { getThemeStore } from '$lib/business/store/theme-store.svelte';
	import * as backup from '$lib/business/backup';
	import { readSessionTimer, writeSessionTimer } from '$lib/presentation/utils/session-timer';
	import { DEMO_SEARCH_PARAM, getDemoTaskTitles } from '$lib/presentation/utils/demo-link';
	import {
		flushPendingToasts,
		showToast,
		showToastAfterReload,
	} from '$lib/presentation/utils/toast';

	let { children }: LayoutProps = $props();

	onMount(flushPendingToasts);

	const themeStore = getThemeStore();

	let backupFileInput: HTMLInputElement | undefined = $state();

	// The only one of the three that does not reload, so its toast can be live.
	async function exportData() {
		// `JSON.stringify` throws RangeError past the string-length cap, so the
		// whole body is guarded, not just the read.
		try {
			const file = await backup.$exportAllStores();

			const url = URL.createObjectURL(
				new Blob([JSON.stringify(file, null, '\t')], {
					type: 'application/json',
				}),
			);

			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `fallow-backup-${file.exportedAt.slice(0, 10)}.json`;
			anchor.click();
			URL.revokeObjectURL(url);
			showToast.success(m.backup_export_done());
		} catch (e) {
			logError('Failed to export backup', e);
			showToast.danger(m.backup_export_failed());
		}
	}

	async function importData(file: File) {
		try {
			await backup.$importAllStores(JSON.parse(await file.text()));
		} catch (e) {
			logError('Failed to import backup', e);
			showToast.danger(m.backup_import_failed());

			return;
		}

		// Stores read IndexedDB once on mount — reload so they pick up the
		// imported records. The confirmation has to outlive that reload.
		showToastAfterReload('success', m.backup_import_done());
		location.reload();
	}

	async function deleteData() {
		// An irreversible delete of every store: stays until an AlertDialog
		// replaces it like-for-like.
		if (!confirm(m.data_delete_confirm())) return; // eslint-disable-line no-alert

		try {
			await backup.$deleteAllStores();
		} catch (e) {
			logError('Failed to delete all data', e);
			showToast.danger(m.data_delete_failed());

			return;
		}

		showToastAfterReload('success', m.data_delete_done());
		location.reload();
	}

	// Created first: every store below reports into it and registers its re-read.
	const storageStatus = setStorageStatusStore();

	const session = setSessionStore(
		() => page.url.searchParams.get('date'),
		storageStatus,
		// Scoped to the planner: `?demo` on the Lab, the calendar or the analytics
		// page means nothing, and this store is every one of their days too.
		() =>
			page.route.id === '/(app)' && page.url.searchParams.has(DEMO_SEARCH_PARAM)
				? getDemoTaskTitles()
				: null,
	);

	const observations = setEnergyObservationStore(() => session.tasks, storageStatus);

	// Why here and not on `/energy`: business/AGENTS.md, "Context is the creation rule".
	setEnergyLabStore(session, observations, storageStatus, () =>
		showToast.danger(m.energy_params_load_failed()),
	);

	// Both screens that offer the clock's controls read it here, so the layout owns the
	// SSR guard and both storage calls (business/AGENTS.md, "A store never imports the
	// toast API; it takes an injected thunk").
	setSessionTimerStore(browser ? readSessionTimer(session.today) : null, writeSessionTimer);

	const storageErrorMessage = $derived(
		storageStatus.error === 'load-failed' ? m.error_body() : m.storage_error(),
	);

	// Calendar is the one full-viewport page: it must never scroll, so its grid
	// rows split the leftover height instead of growing the page.
	const fullViewport = $derived(page.route.id?.endsWith('/calendar') ?? false);
</script>

<main
	class="text-ty-secondary antialiased selection:bg-success/30 selection:text-success-strong flex flex-col
	       {fullViewport ? 'h-dvh overflow-hidden' : 'min-h-screen'}"
>
	<Nav>
		{#snippet actions()}
			<div class="flex items-center gap-grid-xs">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger aria-label={m.nav_switch_theme()}>
						<Palette class="h-4 w-4 shrink-0" />
						<span class="hidden sm:inline">{themeStore.label}</span>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						align="end"
						class="nice-scrollbar w-max min-w-40 max-h-[min(80vh,40rem)] overflow-y-auto"
					>
						<DropdownMenu.RadioGroup
							value={themeStore.theme}
							onValueChange={(v) => themeStore.switchTheme(v as ThemeName)}
						>
							{#each themeStore.themes as theme (theme.name)}
								<DropdownMenu.RadioItem value={theme.name} class="cursor-pointer gap-grid-xs">
									<!-- theme classes scope that theme's CSS vars to the swatch,
									     so the slices always match themes.css. Three slices, not two:
									     `--brand` is the accent nearly every theme tunes away from
									     its primary, so it is what tells the one-signal-colour
									     themes apart from the polychrome ones. -->
									<span
										class="{theme.css.join(
											' ',
										)} border-line-strong flex h-6 w-2 shrink-0 overflow-hidden rounded flex-col border"
										aria-hidden="true"
									>
										<span class="h-full" style="background: var(--surface-page)"></span>
										<span class="h-full" style="background: var(--primary)"></span>
										<span class="h-full" style="background: var(--brand)"></span>
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
					<DropdownMenu.Trigger size="icon-sm" aria-label={m.header_data_menu()}>
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
	<div class="page-column flex min-h-0 flex-1 flex-col py-page">
		{#if session.isDemo}
			<div role="alert" class="banner-shell border-brand/20 bg-brand/5 text-ty-primary">
				<span class="flex-1">{m.demo_banner()}</span>
				<!-- A link and not a button: leaving the example day IS dropping the param,
				     so the address bar has to say so too. -->
				<a
					href={localizeHref(resolve('/'))}
					class="border-brand/30 hover:bg-brand/10 shrink-0 rounded-md border px-text-xs py-text-3xs"
				>
					{m.demo_banner_exit()}
				</a>
			</div>
		{/if}
		{#if storageStatus.error}
			<div role="alert" class="banner-shell border-danger/20 bg-danger/5 text-danger-strong">
				<span class="flex-1">{storageErrorMessage}</span>
				{#if storageStatus.canRetry}
					<button
						type="button"
						onclick={() => storageStatus.retry()}
						class="border-danger/20 hover:bg-danger/10 shrink-0 rounded-md border px-text-xs py-text-3xs"
					>
						{m.error_reload()}
					</button>
				{/if}
				<button
					type="button"
					aria-label={storageErrorMessage}
					onclick={() => storageStatus.clear()}
					class="hover:text-danger-strong shrink-0 rounded-md p-text-2xs"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
		{/if}
		{@render children()}
	</div>

	<Footer />
</main>

<!--
	Fixed-position overlay, so it sits outside the page's layout flow. The region
	label is passed because sonner's default is hardcoded English.
-->
<Toaster containerAriaLabel={m.toast_region_label()} />
