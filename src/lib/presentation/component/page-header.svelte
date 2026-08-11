<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/presentation/component/ui/button';
	import * as DropdownMenu from '$lib/presentation/component/ui/dropdown-menu';
	import * as Tooltip from '$lib/presentation/component/ui/tooltip';
	import type { Task, DailySession, SavedRoutine } from '$lib/business/type';

	interface Props {
		completedTasks: number;
		totalTasks: number;
		selectedDate: string;
		today: string;
		ondatechange: (date: string) => void;
		// Import props
		yesterdaySession: DailySession | null;
		routines: SavedRoutine[];
		currentTasks: Task[];
		onimport: (tasks: Omit<Task, 'id' | 'createdAt' | 'completed'>[]) => void;
		onimportdate: (date: string) => Promise<number>;
		onsaveroutine: (name: string) => void;
		ondeleteroutine: (id: string) => void;
	}

	let {
		completedTasks,
		totalTasks,
		selectedDate,
		today,
		ondatechange,
		yesterdaySession,
		routines,
		currentTasks,
		onimport,
		onimportdate,
		onsaveroutine,
		ondeleteroutine,
	}: Props = $props();

	const isToday = $derived(selectedDate === today);
	const isViewingPast = $derived(selectedDate < today);
	// "Yesterday" is yesterday relative to `today`, not to the day on screen, so
	// the shortcut only means what it says on today; every other day loads by
	// date, which reaches the same session anyway.
	const hasYesterday = $derived(isToday && Boolean(yesterdaySession?.tasks.length));
	const hasRoutines = $derived(routines.length > 0);
	const canSave = $derived(currentTasks.length > 0);

	let showLoadMenu = $state(false);
	let showSaveMenu = $state(false);
	let importDate = $state('');
	let importDateEmpty = $state(false);
	let routineName = $state('');
	let confirmingDelete = $state<string | null>(null);

	// A closed menu holds no draft: reopening must not show last time's typed
	// name, failed date lookup, or armed delete. An effect rather than
	// `onOpenChange`, because a programmatic close (a successful import, a saved
	// routine) writes `open` through the binding and never fires the callback.
	$effect(() => {
		if (showLoadMenu) return;

		importDate = '';
		importDateEmpty = false;
		confirmingDelete = null;
	});

	$effect(() => {
		if (!showSaveMenu) routineName = '';
	});

	async function importFromDate() {
		if (!importDate) return;

		importDateEmpty = false;
		const count = await onimportdate(importDate);

		if (count > 0) {
			showLoadMenu = false;
		} else {
			importDateEmpty = true;
		}
	}

	function importYesterday() {
		if (!yesterdaySession?.tasks.length) return;

		const tasksToImport = yesterdaySession.tasks.map((t) => ({
			title: t.title,
			physicalDifficulty: t.physicalDifficulty,
			mentalDifficulty: t.mentalDifficulty,
			enjoyment: t.enjoyment,
		}));

		onimport(tasksToImport);
	}

	function importRoutine(routine: SavedRoutine) {
		onimport(routine.tasks);
	}

	function deleteRoutine(id: string) {
		confirmingDelete = null;
		ondeleteroutine(id);
	}

	function saveCurrentAsRoutine() {
		if (!routineName.trim() || !currentTasks.length) return;

		onsaveroutine(routineName.trim());
		showSaveMenu = false;
	}
</script>

<div class="flex flex-col gap-grid-md sm:flex-row sm:items-start sm:justify-between mb-text-xl">
	<div class="flex items-center gap-grid-md">
		<!-- The old under-title tagline lives in the title's tooltip now — the
		     header stays one line so the content above the fold is the plan. -->
		<Tooltip.Provider delayDuration={150}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<h1 {...props} class="hint-underline text-2xl font-bold text-ty-primary">
							{m.app_name()}
						</h1>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom" align="start" class="max-w-md">
					<p>{m.header_tagline()}</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
		<div class="flex items-center gap-text-xs text-sm text-ty-secondary">
			<span class="font-medium text-ty-primary">{completedTasks}</span>/<span>{totalTasks}</span>
			{m.common_tasks()}
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-grid-xs sm:shrink-0">
		{#if !isToday}
			<Button variant="outline" size="sm" onclick={() => ondatechange(today)}>
				{m.header_return_to_today()}
			</Button>
		{/if}
		{#if !isViewingPast}
			<DropdownMenu.Root bind:open={showLoadMenu}>
				<DropdownMenu.Trigger>
					<Upload class="h-4 w-4" />
					{m.header_load()}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-64">
					{#if hasYesterday}
						<DropdownMenu.Item onclick={importYesterday}>
							<Clock class="h-4 w-4" />
							{m.header_yesterday({
								count: yesterdaySession?.tasks.length ?? 0,
							})}
						</DropdownMenu.Item>
					{/if}

					{#if hasRoutines}
						{#if hasYesterday}<DropdownMenu.Separator />{/if}
						<DropdownMenu.Label>{m.header_saved_routines()}</DropdownMenu.Label>
						{#each routines as routine (routine.id)}
							{@const isConfirming = confirmingDelete === routine.id}
							<!-- Two sibling menu items in one row, not buttons nested inside one
							     item: a `menuitem` may not own focusable children, and bits-ui's
							     Tab handler jumps focus past the entire menu — so nested buttons
							     are reachable by mouse only. -->
							<DropdownMenu.Group class="group flex items-center">
								<DropdownMenu.Item
									class="min-w-0 flex-1 truncate"
									onclick={() => importRoutine(routine)}
								>
									{routine.name} ({routine.tasks.length})
								</DropdownMenu.Item>
								<!-- Deleting a routine cannot be undone, so the trash only arms it
								     and the second press deletes. Arming changes the two controls,
								     never the row: a routine that turns red end to end reads as
								     already gone, and the load action has to stay put. -->
								<DropdownMenu.Item
									variant="destructive"
									closeOnSelect={false}
									aria-label={isConfirming
										? m.header_confirm_delete_routine({
												name: routine.name,
											})
										: m.header_delete_routine({
												name: routine.name,
											})}
									class={isConfirming
										? 'shrink-0'
										: 'shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100'}
									onclick={() =>
										isConfirming ? deleteRoutine(routine.id) : (confirmingDelete = routine.id)}
								>
									<Trash2 class="h-4 w-4" />
									{#if isConfirming}{m.header_confirm_delete()}{/if}
								</DropdownMenu.Item>
								{#if isConfirming}
									<DropdownMenu.Item
										closeOnSelect={false}
										aria-label={m.common_cancel()}
										class="shrink-0"
										onclick={() => (confirmingDelete = null)}
									>
										<X class="h-4 w-4" />
									</DropdownMenu.Item>
								{/if}
							</DropdownMenu.Group>
						{/each}
					{/if}

					{#if hasYesterday || hasRoutines}
						<DropdownMenu.Separator />
					{/if}
					<DropdownMenu.Label>
						{m.header_from_date()}
					</DropdownMenu.Label>
					<div class="px-box-2xs pb-box-2xs">
						<input
							type="date"
							bind:value={importDate}
							onchange={importFromDate}
							onkeydown={(e) => {
								// Typing owns the field: the menu reads any single character as
								// typeahead and ArrowLeft/Right as item navigation, which would
								// leave the date segments unreachable. ArrowUp/Down stay with the
								// menu on purpose — this input is the content's first tabbable, so
								// it holds focus when the menu opens and they are the only way out
								// of it and onto the routines. So does Escape: its listener sits on
								// `document`, so stopping it here would break close-on-Escape.
								// The routine-name input needs no guard — that menu has no items.
								if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key.length === 1) {
									e.stopPropagation();
								}
							}}
							aria-label={m.header_from_date()}
							class="w-full px-box-2xs py-text-2xs text-sm rounded-sm bg-surface-card border text-ty-secondary focus:outline-none focus:ring-1 focus:ring-brand"
						/>
						{#if importDateEmpty}
							<p class="mt-text-2xs text-xs text-danger">{m.header_no_tasks_on_date()}</p>
						{/if}
					</div>
				</DropdownMenu.Content>
			</DropdownMenu.Root>

			{#if canSave}
				<DropdownMenu.Root bind:open={showSaveMenu}>
					<DropdownMenu.Trigger>
						<Download class="h-4 w-4" />
						{m.common_save()}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-full">
						<div class="p-box-2xs">
							<p class="text-xs text-ty-secondary mb-text-xs">{m.header_save_as_routine()}</p>
							<form
								onsubmit={(e) => {
									e.preventDefault();
									saveCurrentAsRoutine();
								}}
								class="flex gap-grid-xs"
							>
								<input
									type="text"
									bind:value={routineName}
									placeholder={m.header_routine_name_placeholder()}
									class="flex-1 px-box-2xs py-text-2xs text-sm rounded-sm bg-surface-card border text-ty-secondary placeholder:text-ty-silent focus:outline-none focus:ring-1 focus:ring-brand"
								/>
								<!-- Not `common_save` again: the trigger above already carries that
								     name, and two controls with one accessible name is a coin flip
								     for a screen reader. -->
								<Button type="submit" size="sm" variant="outline">
									{m.header_save_routine()}
								</Button>
							</form>
						</div>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		{/if}
	</div>
</div>
