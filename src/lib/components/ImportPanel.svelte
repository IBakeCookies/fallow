<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import type { Task } from '$lib/metrics/calculations';
	import type { DailySession, SavedRoutine } from '$lib/storage/db';

	interface Props {
		yesterdaySession: DailySession | null;
		routines: SavedRoutine[];
		currentTasks: Task[];
		onimport: (tasks: Omit<Task, 'id' | 'createdAt' | 'completed'>[]) => void;
		onsaveroutine: (name: string) => void;
		ondeleteroutine: (id: string) => void;
	}

	let {
		yesterdaySession,
		routines,
		currentTasks,
		onimport,
		onsaveroutine,
		ondeleteroutine
	}: Props = $props();

	let showSaveDialog = $state(false);
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
		showSaveDialog = false;
	}

	const hasYesterday = $derived(!!yesterdaySession?.tasks.length);
	const hasRoutines = $derived(routines.length > 0);
	const canSave = $derived(currentTasks.length > 0);
</script>

<Card.Root class="border-white/10 bg-white/3 backdrop-blur-xl">
	<Card.Header class="pb-2">
		<Card.Title class="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
			Quick Import
		</Card.Title>
	</Card.Header>
	<Card.Content class="pt-0 space-y-2">
		{#if hasYesterday}
			<Button variant="outline" class="w-full justify-start text-left" onclick={importYesterday}>
				<svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				Import Yesterday ({yesterdaySession?.tasks.length} tasks)
			</Button>
		{/if}

		{#if hasRoutines}
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="w-full">
					<Button variant="outline" class="w-full justify-between">
						<span class="flex items-center">
							<svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
								/>
							</svg>
							Load Routine
						</span>
						<svg class="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</Button>
				</DropdownMenu.Trigger>

				<DropdownMenu.Content>
					{#each routines as routine}
						<DropdownMenu.Group>
							<div class="flex items-center justify-between px-2 py-1.5">
								<button
									class="flex-1 text-left text-sm hover:text-emerald-400 transition-colors"
									onclick={() => importRoutine(routine)}
								>
									{routine.name}
									<span class="text-xs text-zinc-500 ml-1">({routine.tasks.length})</span>
								</button>
								<button
									class="p-1 text-zinc-500 hover:text-red-400 transition-colors"
									onclick={() => ondeleteroutine(routine.id)}
									title="Delete routine"
								>
									<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
						</DropdownMenu.Group>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		{/if}

		{#if canSave}
			{#if showSaveDialog}
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={routineName}
						placeholder="Routine name..."
						class="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500/50"
						onkeydown={(e) => e.key === 'Enter' && saveCurrentAsRoutine()}
					/>
					<Button size="sm" onclick={saveCurrentAsRoutine}>Save</Button>
					<Button size="sm" variant="ghost" onclick={() => (showSaveDialog = false)}>✕</Button>
				</div>
			{:else}
				<Button
					variant="ghost"
					class="w-full justify-start text-zinc-500 hover:text-zinc-300"
					onclick={() => (showSaveDialog = true)}
				>
					<svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Save current as routine
				</Button>
			{/if}
		{/if}

		{#if !hasYesterday && !hasRoutines && !canSave}
			<p class="text-xs text-zinc-600 text-center py-2">
				Add tasks to enable quick import features
			</p>
		{/if}
	</Card.Content>
</Card.Root>
