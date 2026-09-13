<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Clock from '@lucide/svelte/icons/clock';
	import Download from '@lucide/svelte/icons/download';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Upload from '@lucide/svelte/icons/upload';
	import X from '@lucide/svelte/icons/x';
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/presentation/utils';
	import type { SessionTimer } from '$lib/business/utils/session-timer';
	import { Button } from '$lib/presentation/component/ui/button';
	import SessionClock from '$lib/presentation/component/session-clock.svelte';
	import * as DropdownMenu from '$lib/presentation/component/ui/dropdown-menu';
	import type { Task, DailySession, SavedRoutine } from '$lib/business/type';

	interface Props {
		selectedDate: string;
		today: string;
		yesterdaySession: DailySession | null;
		routines: SavedRoutine[];
		currentTasks: Task[];
		/** The day's session clock. Bindable: `SessionTimerStore`'s, so a session started
		 *  on one screen counts on the other and its reading stays the page's. */
		timer: SessionTimer | null;
		getSuggestedMinutes: () => number;
		onimport: (tasks: Omit<Task, 'id' | 'createdAt' | 'completed'>[]) => void;
		onimportdate: (date: string) => Promise<number>;
		onsaveroutine: (name: string) => void;
		ondeleteroutine: (id: string) => void;
		/** How many tasks a carry would move; 0 hides the control. */
		carryCount: number;
		oncarry: () => void;
		class?: string;
	}

	let {
		selectedDate,
		today,
		yesterdaySession,
		routines,
		currentTasks,
		timer = $bindable(),
		getSuggestedMinutes,
		onimport,
		onimportdate,
		onsaveroutine,
		ondeleteroutine,
		carryCount,
		oncarry,
		class: className,
	}: Props = $props();

	const id = $props.id();

	const isToday = $derived(selectedDate === today);
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

		onimport(yesterdaySession.tasks);
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

<!-- Wraps, and gives up width when asked: two ~150px menus, the length field and a stopped
     reading's line of copy sit beside the readout, which is more than 375px holds in a row.
     Wrapped rows align left, against the same edge as everything above them. -->
<div class={cn('flex flex-wrap items-center justify-start sm:justify-end gap-grid-xs', className)}>
	{#if carryCount > 0}
		<Button size="sm" variant="ghost" class="gap-text-xs" onclick={oncarry}>
			<ArrowRight class="h-4 w-4" />
			{m.header_carry({
				count: carryCount,
			})}
		</Button>
	{/if}

	<!-- Today only, unlike its neighbours: a day being planned can be loaded and saved,
	     but a new 🪫 measurement is today's alone, and this reading fills one. -->
	{#if isToday}
		<SessionClock {today} bind:timer {getSuggestedMinutes} />
	{/if}

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
						<!-- Deleting a routine cannot be undone, so the trash only arms it and
								     the second press deletes. Arming changes the two controls, never
								     the row: a routine red end to end reads as already gone, and the
								     load action has to stay put. No fill; the ring is its keyboard cue. -->
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
							class={[
								'shrink-0 focus:bg-transparent! focus-visible:ring-3 focus-visible:ring-ring',
								isConfirming ||
									'opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100',
							]}
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
								class="shrink-0 focus:bg-transparent! focus-visible:ring-3 focus-visible:ring-ring"
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
					id="{id}-import-date"
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
					class="field-input"
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
						class="flex items-end gap-grid-xs"
					>
						<input
							id="{id}-routine-name"
							type="text"
							bind:value={routineName}
							placeholder={m.header_routine_name_placeholder()}
							class="field-input flex-1"
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
</div>
