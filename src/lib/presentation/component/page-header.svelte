<script lang="ts">
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
		onsaveroutine,
		ondeleteroutine
	}: Props = $props();

	const isToday = $derived(selectedDate === today);
	const isViewingPast = $derived(selectedDate < today);
	const hasYesterday = $derived(!!yesterdaySession?.tasks.length);
	const hasRoutines = $derived(routines.length > 0);
	const canSave = $derived(currentTasks.length > 0);
	const hasLoadOptions = $derived(hasYesterday || hasRoutines);

	let showSaveInput = $state(false);
	let routineName = $state('');

	function importYesterday() {
		if (!yesterdaySession?.tasks.length) return;
		const tasksToImport = yesterdaySession.tasks.map((t) => ({
			title: t.title,
			physicalDifficulty: t.physicalDifficulty,
			mentalDifficulty: t.mentalDifficulty,
			enjoyment: t.enjoyment
		}));
		onimport(tasksToImport);
	}

	function importRoutine(routine: SavedRoutine) {
		onimport(routine.tasks);
	}

	function saveCurrentAsRoutine() {
		if (!routineName.trim() || !currentTasks.length) return;
		onsaveroutine(routineName.trim());
		routineName = '';
		showSaveInput = false;
	}
</script>

<div class="flex flex-col gap-grid-md sm:flex-row sm:items-start sm:justify-between mb-6">
	<div>
		<div class="flex items-center gap-grid-md">
			<!-- The old under-title tagline lives in the title's tooltip now — the
			     header stays one line so the content above the fold is the plan. -->
			<Tooltip.Provider delayDuration={150}>
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<h1
								{...props}
								class="cursor-help text-2xl font-bold text-ty-primary underline decoration-ty-ghost decoration-dotted underline-offset-4"
							>
								{m.app_name()}
							</h1>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content
						side="bottom"
						align="start"
						class="max-w-md bg-surface-page border-line-strong text-ty-primary"
					>
						<p>{m.header_tagline()}</p>
					</Tooltip.Content>
				</Tooltip.Root>
			</Tooltip.Provider>
			<div class="flex items-center gap-2 text-sm text-ty-secondary">
				<span class="font-medium text-ty-primary">{completedTasks}</span>/<span>{totalTasks}</span>
				{m.common_tasks()}
			</div>
		</div>
	</div>

	<div class="flex flex-wrap items-center gap-2 sm:gap-grid-xs sm:shrink-0">
		{#if !isToday}
			<Button variant="outline" size="sm" onclick={() => ondatechange(today)}>
				{m.header_return_to_today()}
			</Button>
		{/if}
		{#if !isViewingPast}
			{#if hasLoadOptions}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button variant="outline" size="sm" class="gap-2">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
								/>
							</svg>
							{m.header_load()}
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-64">
						{#if hasYesterday}
							<DropdownMenu.Item onclick={importYesterday}>
								<svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								{m.header_yesterday({ count: yesterdaySession?.tasks.length ?? 0 })}
							</DropdownMenu.Item>
						{/if}

						{#if hasRoutines}
							{#if hasYesterday}<DropdownMenu.Separator />{/if}
							<DropdownMenu.Label>{m.header_saved_routines()}</DropdownMenu.Label>
							{#each routines as routine (routine.id)}
								<DropdownMenu.Item class="flex justify-between group">
									<button onclick={() => importRoutine(routine)} class="flex-1 text-left">
										{routine.name} ({routine.tasks.length})
									</button>
									<button
										aria-label={m.header_delete_routine({ name: routine.name })}
										onclick={(e) => {
											e.stopPropagation();
											ondeleteroutine(routine.id);
										}}
										class="opacity-0 [@media(hover:none)]:opacity-100 group-hover:opacity-100 text-danger hover:text-danger-strong ml-2"
									>
										<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
											/>
										</svg>
									</button>
								</DropdownMenu.Item>
							{/each}
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}

			{#if canSave}
				<DropdownMenu.Root bind:open={showSaveInput}>
					<DropdownMenu.Trigger>
						<Button variant="outline" size="sm" class="gap-2">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
								/>
							</svg>
							{m.common_save()}
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-full">
						<div class="p-2">
							<p class="text-xs text-ty-secondary mb-2">{m.header_save_as_routine()}</p>
							<form
								onsubmit={(e) => {
									e.preventDefault();
									saveCurrentAsRoutine();
								}}
								class="flex gap-2"
							>
								<input
									type="text"
									bind:value={routineName}
									placeholder={m.header_routine_name_placeholder()}
									class="flex-1 px-2 py-1 text-sm rounded bg-surface-card border text-ty-secondary placeholder:text-ty-silent focus:outline-none focus:ring-1 focus:ring-brand"
								/>
								<Button type="submit" size="sm" variant="outline">{m.common_save()}</Button>
							</form>
						</div>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{/if}
		{/if}
	</div>
</div>
