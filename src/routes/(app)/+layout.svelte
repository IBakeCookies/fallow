<script lang="ts">
	import type { LayoutProps } from './$types';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
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
	import { getThemeStore } from '$lib/business/store/theme-store.svelte';
	import * as backup from '$lib/business/backup';
	import {
		flushPendingToasts,
		showToast,
		showToastAfterReload,
	} from '$lib/presentation/utils/toast';

	let { children }: LayoutProps = $props();

	// Every real route lives under (app), so a reload lands here and flushes. The
	// one gap is `routes/+error.svelte`, which sits above this layout: a reload
	// that errors out shows no confirmation, and the queued message then fires on
	// the next page the user opens. Not worth a TTL — it costs one stale toast on
	// a path that has already failed louder.
	onMount(flushPendingToasts);

	const themeStore = getThemeStore();

	let backupFileInput: HTMLInputElement | undefined = $state();

	// The only one of the three that does not reload, so its toast can be live.
	async function exportData() {
		// The whole body is guarded, not just the read: `JSON.stringify` throws
		// RangeError on a database past the string-length cap, and that failure
		// looks identical to the user.
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
		// This guards an irreversible delete of every store; it stays until an
		// AlertDialog replaces it like-for-like. A toast is not a confirmation.
		if (!confirm(m.data_delete_confirm())) return; // eslint-disable-line no-alert

		// $deleteAllStores rejects if the database will not open or the wipe
		// transaction aborts — a second tab blocking an upgrade is enough. Without
		// this the reload never happens, every record is still there, and the user
		// has been shown nothing at all.
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

	// The one persistence banner for the whole app. Created first because every
	// store below reports into it, and each registers its own re-read — so the
	// retry button covers them without this layout keeping a list.
	const storageStatus = setStorageStatusStore();

	// The shared daily session (tasks, budget, pools + persistence) lives in
	// context, created per component tree — never at module scope, so nothing
	// can leak across SSR requests. Pages grab it with getSessionStore().
	// The routing dependency is the layout's, not the store's: the store is
	// handed a reader for the viewed day instead of importing $app/state.
	const session = setSessionStore(() => page.url.searchParams.get('date'), storageStatus);

	// Drain/rest measurements key on the live clock, not the viewed day, so they
	// are their own store — wired here because the layout owns what each store
	// gets: a task lookup, and the banner they report into.
	setEnergyObservationStore(() => session.tasks, storageStatus);

	// A failed read and a failed write need different copy and different actions:
	// a read is retryable, a write has already lost the edit.
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
	<div
		class="mx-auto w-full max-w-7xl px-page-sm py-page sm:px-page-md lg:px-page flex min-h-0 flex-1 flex-col"
	>
		<Nav>
			{#snippet actions()}
				<div class="flex items-center gap-grid-xs">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger variant="pill" aria-label={m.nav_switch_theme()}>
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
										     so the slices always match themes.css -->
										<span
											class="{theme.css.join(
												' ',
											)} border-line-strong flex h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full border"
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
							<!-- absent under prefers-reduced-motion: the CSS pauses scenery
							     there no matter what the cookie says, so the control would
							     only mislabel a state it cannot change -->
							{#if themeStore.sceneryMotionToggleable}
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
							{/if}
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
		{#if storageStatus.error}
			<div
				role="alert"
				class="border-danger/20 bg-danger/5 text-danger-strong mt-grid-md flex items-center gap-grid-sm rounded-xl border p-box-md text-sm"
			>
				<span class="flex-1">{storageErrorMessage}</span>
				{#if storageStatus.error === 'load-failed'}
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
		<Footer />
	</div>
</main>

<!--
	Fixed-position overlay, so it sits outside the page's layout flow. The region
	label is passed because sonner's default is hardcoded English, and it is the
	accessible name of a live region on a site that serves /de/*.
-->
<Toaster containerAriaLabel={m.toast_region_label()} />
