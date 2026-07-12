<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import TaskForm from '$lib/components/TaskForm.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TaskList from '$lib/components/TaskList.svelte';
	import TimeBudgetCard from '$lib/components/TimeBudgetCard.svelte';
	import MetricsDashboard from '$lib/components/MetricsDashboard.svelte';
	import { STATUS, getStatusBiggerBetter, getStatusSmallerBetter } from '$lib/metrics/status';
	import {
		type Task,
		getEffectiveDifficulty,
		calculateSuggestedTasks,
		calculateInterleavedOrder,
		calculateZenithGain,
		calculateCompletionRate,
		calculateYieldIndex,
		calculateFlowCoverage,
		calculateHumanCapacity,
		calculateBottleneckTask,
		calculateTimeScarcity,
		calculateBurnoutRisk,
		calculateCognitiveLoad,
		calculatePhysicalLoad,
		calculateEnergyBalance,
		calculateFrictionIndex,
		calculateDailyQuadrant,
		calculateBudgetConvergence,
		calculateMomentum,
		calculateDeepWorkRatio,
		calculateQuickWins,
		calculateTaskVariety,
		calculateGrindDensity,
		calculateRewardDensity,
		calculateRecoveryRatio,
		calculateAveragePhysicalDifficulty,
		calculateAverageMentalDifficulty,
		calculateAverageEnjoyment
	} from '$lib/metrics/calculations';
	import {
		DEFAULT_SWITCH_COST,
		DEFAULT_CAPACITY_POOLS,
		fitUserConstants,
		mapEffort,
		mapEnjoyability
	} from '$lib/zenith';
	import {
		initDB,
		saveSession,
		getSession,
		getYesterdaySession,
		getAllRoutines,
		saveRoutine,
		deleteRoutine,
		saveFlowObservation,
		getAllFlowObservations,
		deleteFlowObservation,
		clearFlowObservations,
		type DailySession,
		type SavedRoutine,
		type FlowObservationRecord
	} from '$lib/storage/db';
	import { liveToday } from '$lib/today.svelte';

	const today = $derived(liveToday.value);

	// State
	let tasks = $state<Task[]>([]);
	let availableHours = $state<number>(0);
	let switchCost = $state<number>(DEFAULT_SWITCH_COST);
	let cognitivePool = $state<number>(DEFAULT_CAPACITY_POOLS.cognitiveHours);
	let physicalPool = $state<number>(DEFAULT_CAPACITY_POOLS.physicalHours);
	let isLoading = $state(true);
	let yesterdaySession = $state<DailySession | null>(null);
	let routines = $state<SavedRoutine[]>([]);
	let flowObservations = $state<FlowObservationRecord[]>([]);

	// The URL is the single source of truth for the viewed day: /?date=YYYY-MM-DD
	// for any other day, plain / for today. Nav links, calendar deep-links, and
	// the browser back button all resolve through this — invalid dates fall
	// back to today.
	const dateParam = $derived(page.url.searchParams.get('date'));
	const selectedDate = $derived(
		dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today
	);

	// Day modes: past is read-only history (completion toggles only), future
	// is a plan you can edit freely; flow logging — an actual measurement —
	// stays today-only.
	const isViewingPast = $derived(selectedDate < today);
	const isViewingFuture = $derived(selectedDate > today);

	// Which date the in-memory session state belongs to. Loads are async, so
	// this lags selectedDate during navigation — the auto-save guard below uses
	// it to avoid persisting one day's tasks under another day's key.
	let loadedDate = $state<string | null>(null);

	// Whether the loaded date already has a persisted session. Auto-save skips
	// pristine days (so merely browsing future dates creates no records) but
	// keeps saving once a session exists (so deleting the last task persists).
	let loadedHadSession = $state(false);

	// Initialize from IndexedDB
	onMount(async () => {
		if (!browser) return;

		try {
			await initDB();

			// Load yesterday for import option
			yesterdaySession = await getYesterdaySession();

			// Load saved routines
			routines = await getAllRoutines();

			// Load measured time-to-flow data (personalizes c₁,c₂,c₃)
			flowObservations = await getAllFlowObservations();

			await loadSession(selectedDate);
		} catch (e) {
			console.error('Failed to load from IndexedDB', e);
		} finally {
			isLoading = false;
		}
	});

	// /?date=<today> renders the same view as / — collapse to the canonical
	// URL. Also fires when a viewed date BECOMES today at midnight rollover.
	$effect(() => {
		if (browser && dateParam === today) {
			goto('/', { replaceState: true, noScroll: true, keepFocus: true });
		}
	});

	// Reload whenever the viewed date changes, whatever triggered the
	// navigation (nav "Today" link, calendar deep-link, back/forward button).
	$effect(() => {
		if (browser && !isLoading && selectedDate !== loadedDate) {
			loadSession(selectedDate);
		}
	});

	async function loadSession(date: string) {
		try {
			const session = await getSession(date);
			if (date !== selectedDate) return; // navigated again mid-load

			if (session) {
				tasks = session.tasks;
				availableHours = session.availableHours;
				switchCost = session.switchCost;
				cognitivePool = session.cognitivePool ?? DEFAULT_CAPACITY_POOLS.cognitiveHours;
				physicalPool = session.physicalPool ?? DEFAULT_CAPACITY_POOLS.physicalHours;
			} else {
				// No data for this date
				tasks = [];
				availableHours = 0;
				switchCost = DEFAULT_SWITCH_COST;
				cognitivePool = DEFAULT_CAPACITY_POOLS.cognitiveHours;
				physicalPool = DEFAULT_CAPACITY_POOLS.physicalHours;
			}
			loadedHadSession = !!session;
			loadedDate = date;
		} catch (e) {
			console.error('Failed to load session for date', date, e);
		}
	}

	// Navigate to a day; the $effect above picks up the URL change and loads it.
	function gotoDate(newDate: string) {
		goto(newDate === today ? '/' : `/?date=${newDate}`, { noScroll: true, keepFocus: true });
	}

	function formatDisplayDate(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	// Core derived values
	const totalTasks = $derived(tasks.length);
	const completedTasksCount = $derived(tasks.filter((task) => task.completed).length);

	// Capacity pools, sanitized (empty/invalid inputs → 0, i.e. no capacity)
	const pools = $derived({
		cognitiveHours: Math.max(0, Number(cognitivePool) || 0),
		physicalHours: Math.max(0, Number(physicalPool) || 0)
	});

	// Personalized model constants: ridge least-squares fit of ϕ = c₁E + c₂β + c₃
	// over the logged time-to-flow measurements, anchored to the article's
	// defaults. Every ⚡ log nudges the model; more logs = less anchor.
	const constantsFit = $derived(
		fitUserConstants(flowObservations.map((o) => ({ E: o.E, beta: o.beta, phi: o.phiHours })))
	);
	const userConstants = $derived(constantsFit.constants);
	const modelStatus = $derived(
		constantsFit.fitted
			? `Model personalized from ${flowObservations.length} time-to-flow log${
					flowObservations.length === 1 ? '' : 's'
				} (⚡) — blended with the defaults, sharpens as you log more`
			: flowObservations.length > 0
				? `Your ${flowObservations.length} flow log${
						flowObservations.length === 1 ? '' : 's'
					} produced an implausible fit (predicted flow times over 16h) — using default constants. Check the logs below for mistakes.`
				: 'Model uses default constants — log time-to-flow (⚡) on tasks to start personalizing'
	);

	const suggestedTasks = $derived(
		calculateSuggestedTasks(tasks, availableHours, switchCost, pools, userConstants)
	);
	const activeTasks = $derived(suggestedTasks.filter((t) => !t.completed));

	// Hours the plan deliberately leaves unspent (optimal stopping + pool caps).
	// Switch overhead counts only tasks that actually received time, matching
	// the allocator.
	const planSlackHours = $derived.by(() => {
		const budget = Number(availableHours) || 0;
		const fundedCount = suggestedTasks.filter((t) => t.suggestedHours > 0).length;
		const overhead = fundedCount > 1 ? (fundedCount - 1) * switchCost : 0;
		const effectiveBudget = Math.max(0, budget - overhead);
		const allocated = suggestedTasks.reduce((sum, t) => sum + t.suggestedHours, 0);
		return Math.max(0, effectiveBudget - allocated);
	});

	// Suggested run order: alternates cognitive/physical tasks so the resting
	// energy system recovers (dual-pool model). Map of task id → 1-based position.
	const runOrder = $derived(
		new Map(calculateInterleavedOrder(activeTasks).map((t, i) => [t.id, i + 1]))
	);

	const remainingSuggestedHours = $derived(
		(
			Math.round(activeTasks.reduce((sum, task) => sum + task.suggestedHours, 0) * 100) / 100
		).toFixed(2)
	);

	// Metric calculations
	const zenithGain = $derived(
		calculateZenithGain(tasks, availableHours, switchCost, pools, userConstants)
	);
	const completionRate = $derived(calculateCompletionRate(suggestedTasks));
	const yieldIndex = $derived(calculateYieldIndex(suggestedTasks));
	const flowCoverage = $derived(calculateFlowCoverage(activeTasks));
	const humanCapacity = $derived(calculateHumanCapacity(activeTasks, pools));
	const bottleneckTask = $derived(calculateBottleneckTask(activeTasks));
	const timeScarcity = $derived(
		calculateTimeScarcity(tasks, availableHours, switchCost, userConstants)
	);
	const burnoutRisk = $derived(calculateBurnoutRisk(activeTasks, availableHours, switchCost));
	const cognitiveLoad = $derived(calculateCognitiveLoad(activeTasks, availableHours));
	const physicalLoad = $derived(calculatePhysicalLoad(activeTasks, availableHours));
	const energyBalance = $derived(calculateEnergyBalance(cognitiveLoad, physicalLoad));
	const frictionIndex = $derived(calculateFrictionIndex(activeTasks));
	const dailyQuadrant = $derived(calculateDailyQuadrant(tasks));
	const budgetConvergence = $derived(
		calculateBudgetConvergence(activeTasks, availableHours, switchCost)
	);
	const momentum = $derived(calculateMomentum(tasks));
	const deepWorkRatio = $derived(calculateDeepWorkRatio(activeTasks, availableHours));
	const quickWins = $derived(calculateQuickWins(activeTasks));
	const taskVariety = $derived(calculateTaskVariety(activeTasks));
	const grindDensity = $derived(calculateGrindDensity(activeTasks));
	const rewardDensity = $derived(calculateRewardDensity(activeTasks, availableHours));
	const recoveryRatio = $derived(calculateRecoveryRatio(activeTasks));

	// Averages
	const averagePhysicalDifficulty = $derived(calculateAveragePhysicalDifficulty(tasks));
	const averageMentalDifficulty = $derived(calculateAverageMentalDifficulty(tasks));
	const averageEnjoyment = $derived(calculateAverageEnjoyment(tasks));

	// Empty-state guards: metrics that are undefined without tasks/budget show N/A
	const hasTasks = $derived(tasks.length > 0);
	const hasActive = $derived(activeTasks.length > 0);
	const hasBudget = $derived(availableHours > 0);
	const NA = { value: 'N/A', valStyle: STATUS.NEUTRAL.color };

	// Metrics array for dashboard
	const metrics = $derived([
		{
			label: 'Zenith Gain',
			description:
				'Productivity improvement from Zenith optimization vs. naive equal time split. Based on the Lagrange multiplier solution.',
			...(hasTasks && hasBudget
				? {
						value: `+${zenithGain.gainPercent}%`,
						valStyle:
							zenithGain.gainPercent >= 15
								? STATUS.SUCCESS.color
								: zenithGain.gainPercent >= 5
									? STATUS.NEUTRAL.color
									: STATUS.WARNING.color
					}
				: NA)
		},
		{
			label: 'Yield Index',
			description:
				'Did you complete the highest-priority tasks? Compares your completed work against the optimal selection.',
			...(completedTasksCount > 0
				? { value: `${yieldIndex}%`, valStyle: getStatusBiggerBetter(yieldIndex).color }
				: NA)
		},
		{
			label: 'Completion Rate',
			description:
				'Priority-weighted progress. High-value tasks contribute more to this percentage than low-priority ones.',
			...(hasTasks
				? { value: `${completionRate}%`, valStyle: getStatusBiggerBetter(completionRate).color }
				: NA)
		},
		{
			label: 'Flow Coverage',
			description:
				'Tasks that reach flow state (allocated time ≥ ϕ). Low coverage means too many tasks for budget — drop tasks or add hours.',
			...(hasActive && hasBudget
				? {
						value: `${flowCoverage.reached}/${flowCoverage.total}`,
						valStyle:
							flowCoverage.reached === flowCoverage.total
								? STATUS.SUCCESS.color
								: flowCoverage.reached >= flowCoverage.total / 2
									? STATUS.NEUTRAL.color
									: STATUS.WARNING.color
					}
				: NA)
		},
		{
			label: 'Human Capacity',
			description: `${humanCapacity.limitType === 'cognitive' ? 'Cognitive' : 'Physical'} limit (${humanCapacity.limitType === 'cognitive' ? pools.cognitiveHours : pools.physicalHours}h/day, configurable in Time Budget). The allocator enforces these pools, so suggested plans stay ≤100% — this shows how much of your sustainable capacity the plan uses.`,
			...(hasActive && hasBudget
				? {
						value: `${humanCapacity.percent}%`,
						valStyle:
							humanCapacity.percent <= 75
								? STATUS.SUCCESS.color
								: humanCapacity.percent <= 100
									? STATUS.NEUTRAL.color
									: STATUS.CRITICAL.color
					}
				: NA)
		},
		{
			label: 'Time Scarcity',
			description:
				'How stretched is your time budget? Higher values mean too many tasks for the hours available.',
			...(hasTasks
				? { value: `${timeScarcity}%`, valStyle: getStatusSmallerBetter(timeScarcity).color }
				: NA)
		},
		{
			label: 'Primary Bottleneck',
			value: bottleneckTask,
			description:
				'The task requiring the most energy to reach flow state (highest effort-to-enjoyability ratio in Zenith terms).',
			valStyle: bottleneckTask !== 'None Detected' ? STATUS.WARNING.color : STATUS.NEUTRAL.color
		},
		{
			label: 'Burnout Risk',
			description:
				'Strain accumulates when difficulty > enjoyment (weighted by mental intensity), plus budget overhang: hours you plan beyond the optimal workload (1.79×ϕ per task) land in the diminishing-returns zone and count double. 5 strain-hours = 100% risk.',
			...(hasActive && hasBudget
				? { value: `${burnoutRisk}%`, valStyle: getStatusSmallerBetter(burnoutRisk).color }
				: NA)
		},
		{
			label: 'Cognitive Load',
			description: 'Percentage of your day allocated to mental/cognitive tasks.',
			...(hasActive && hasBudget
				? {
						value: `${cognitiveLoad}%`,
						valStyle: getStatusSmallerBetter(cognitiveLoad > 70 ? cognitiveLoad : 0).color
					}
				: NA)
		},
		{
			label: 'Physical Load',
			description: 'Percentage of your day allocated to physical tasks.',
			...(hasActive && hasBudget
				? {
						value: `${physicalLoad}%`,
						valStyle: getStatusSmallerBetter(physicalLoad > 70 ? physicalLoad : 0).color
					}
				: NA)
		},
		{
			label: 'Energy Balance',
			description:
				'Distribution of Cognitive vs physical work. Alternating types extends total productive hours.',
			...(hasActive && hasBudget
				? {
						value:
							energyBalance > 60
								? 'Cognitive Heavy'
								: energyBalance < 40
									? 'Physical Heavy'
									: 'Balanced',
						valStyle:
							energyBalance > 60 || energyBalance < 40 ? STATUS.WARNING.color : STATUS.SUCCESS.color
					}
				: NA)
		},
		{
			label: 'Schedule Integrity',
			description:
				'Detects fragmentation. Drops if tasks get less than 15 minutes, or if no time budget is set.',
			...(hasActive
				? {
						value: `${budgetConvergence}%`,
						valStyle: getStatusBiggerBetter(budgetConvergence).color
					}
				: NA)
		},
		{
			label: 'Friction Index',
			description:
				'Share of your allocated time spent on high-difficulty, low-enjoyment work (time-weighted average of E−β). 100% = every planned hour is maximum-friction work.',
			...(hasActive && hasBudget
				? { value: `${frictionIndex}%`, valStyle: getStatusSmallerBetter(frictionIndex).color }
				: NA)
		},
		{
			label: 'Deep Work',
			description:
				'Percentage of time allocated to high mental difficulty (≥7) tasks requiring sustained focus.',
			...(hasActive && hasBudget
				? { value: `${deepWorkRatio}%`, valStyle: getStatusBiggerBetter(deepWorkRatio).color }
				: NA)
		},
		{
			label: 'Quick Wins',
			description:
				'Count of easy, enjoyable tasks available for momentum building and motivation boosts.',
			...(hasActive
				? {
						value: `${quickWins}`,
						valStyle: quickWins > 0 ? STATUS.SUCCESS.color : STATUS.NEUTRAL.color
					}
				: NA)
		},
		{
			label: 'Task Variety',
			description:
				'Diversity across mental/physical spectrum. Mixing cognitive, physical, and balanced tasks prevents fatigue.',
			...(hasActive
				? { value: `${taskVariety}%`, valStyle: getStatusBiggerBetter(taskVariety).color }
				: NA)
		},
		{
			label: 'Grind Density',
			description:
				'Percentage of tasks where difficulty exceeds enjoyment. High values signal willpower drain.',
			...(hasActive
				? { value: `${grindDensity}%`, valStyle: getStatusSmallerBetter(grindDensity).color }
				: NA)
		},
		{
			label: 'Sustainable Work',
			description:
				'Percentage of time on tasks where enjoyment ≥ difficulty. Higher = more energizing workday.',
			...(hasActive && hasBudget
				? { value: `${rewardDensity}%`, valStyle: getStatusBiggerBetter(rewardDensity).color }
				: NA)
		},
		{
			label: 'Recovery Ratio',
			value: recoveryRatio,
			description:
				'Easy tasks (≤4) per hard tasks (≥7). Aim for 1:2 or 1:3 ratio for ultradian rhythm recovery.',
			valStyle:
				recoveryRatio === 'No strain' || recoveryRatio === 'N/A'
					? STATUS.NEUTRAL.color
					: recoveryRatio.startsWith('0:')
						? STATUS.WARNING.color
						: STATUS.SUCCESS.color
		},
		{
			label: 'Day Profile',
			description:
				"Your day's character based on average difficulty and enjoyment. Flow Zone = challenging and engaging, Grind Mode = demanding work, Cruise = light and enjoyable, Routine = low-key tasks.",
			...(hasTasks
				? {
						value: {
							flow: 'Flow Zone',
							grind: 'Grind Mode',
							cruise: 'Cruise',
							routine: 'Routine'
						}[dailyQuadrant],
						valStyle: STATUS.NEUTRAL.color
					}
				: NA)
		},
		{
			label: 'Avg Physical Diff',
			description: 'Average physical difficulty across all tasks.',
			...(hasTasks
				? { value: `${averagePhysicalDifficulty}/10`, valStyle: STATUS.NEUTRAL.color }
				: NA)
		},
		{
			label: 'Avg Mental Diff',
			description: 'Average mental/cognitive difficulty across all tasks.',
			...(hasTasks
				? { value: `${averageMentalDifficulty}/10`, valStyle: STATUS.NEUTRAL.color }
				: NA)
		},
		{
			label: 'Avg Enjoyment',
			description: 'Average enjoyment across all tasks. Higher values indicate more engaging work.',
			...(hasTasks ? { value: `${averageEnjoyment}/10`, valStyle: STATUS.NEUTRAL.color } : NA)
		}
	]);

	function addTask(taskData: {
		title: string;
		physicalDifficulty: number;
		mentalDifficulty: number;
		enjoyment: number;
	}) {
		tasks = [
			{
				id: Date.now(),
				title: taskData.title,
				physicalDifficulty: taskData.physicalDifficulty,
				mentalDifficulty: taskData.mentalDifficulty,
				enjoyment: taskData.enjoyment,
				createdAt: selectedDate,
				completed: false
			},
			...tasks
		];
	}

	// Completion can be toggled on ANY day — forgetting to check a task off
	// before midnight shouldn't falsify history. Structural edits (add/edit/
	// remove) work on today and future plans; past days stay read-only:
	// those rewrite the plan, this records the truth.
	async function toggleTask(id: number) {
		tasks = tasks.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task));

		// The auto-save $effect doesn't persist past sessions, so historical
		// toggles are saved explicitly under the viewed date.
		if (isViewingPast) {
			try {
				await saveSession({
					date: selectedDate,
					tasks: $state.snapshot(tasks),
					availableHours,
					switchCost,
					cognitivePool,
					physicalPool,
					updatedAt: Date.now()
				});
			} catch (e) {
				console.error('Failed to save completion change for', selectedDate, e);
			}
		}
	}

	function removeTask(id: number) {
		tasks = tasks.filter((task) => task.id !== id);
	}

	function updateTask(
		id: number,
		changes: {
			title: string;
			physicalDifficulty: number;
			mentalDifficulty: number;
			enjoyment: number;
		}
	) {
		tasks = tasks.map((task) => (task.id === id ? { ...task, ...changes } : task));
	}

	// Log a measured "minutes until flow" for a task: stamps it on the task
	// (shown as the ⚡ badge, persisted with the session) and upserts an
	// (E, β, ϕ) data point that personalizes the model constants — re-logging
	// the same task today REPLACES the earlier measurement (typo correction).
	async function logFlow(id: number, minutes: number) {
		const task = tasks.find((t) => t.id === id);
		if (!task) return;

		tasks = tasks.map((t) => (t.id === id ? { ...t, flowMinutes: minutes } : t));

		const difficulty = getEffectiveDifficulty(task);
		try {
			await saveFlowObservation({
				date: today,
				taskId: id,
				taskTitle: task.title,
				difficulty,
				enjoyment: task.enjoyment,
				E: mapEffort(difficulty),
				beta: mapEnjoyability(task.enjoyment),
				phiHours: minutes / 60
			});
			flowObservations = await getAllFlowObservations();
		} catch (e) {
			console.error('Failed to save flow observation', e);
		}
	}

	// Remove one measured data point; the constants refit automatically since
	// they are derived from the observations. Clears today's ⚡ badge if the
	// deleted log belonged to a task in today's session.
	async function deleteFlowLog(id: number) {
		const record = flowObservations.find((o) => o.id === id);
		try {
			await deleteFlowObservation(id);
			flowObservations = await getAllFlowObservations();
			if (record && record.date === today) {
				tasks = tasks.map((t) => (t.id === record.taskId ? { ...t, flowMinutes: undefined } : t));
			}
		} catch (e) {
			console.error('Failed to delete flow observation', e);
		}
	}

	// Delete all measured data points → model reverts to the article defaults.
	async function resetFlowLogs() {
		try {
			await clearFlowObservations();
			flowObservations = [];
			tasks = tasks.map((t) => (t.flowMinutes ? { ...t, flowMinutes: undefined } : t));
		} catch (e) {
			console.error('Failed to reset flow observations', e);
		}
	}

	function importTasks(importedTasks: Omit<Task, 'id' | 'createdAt' | 'completed'>[]) {
		const newTasks = importedTasks.map((t) => ({
			...t,
			id: Date.now() + Math.random(),
			createdAt: selectedDate,
			completed: false
		}));
		tasks = [...newTasks, ...tasks];
	}

	async function handleSaveRoutine(name: string) {
		const routine: SavedRoutine = {
			id: `routine-${Date.now()}`,
			name,
			tasks: tasks.map((t) => ({
				title: t.title,
				physicalDifficulty: t.physicalDifficulty,
				mentalDifficulty: t.mentalDifficulty,
				enjoyment: t.enjoyment
			})),
			createdAt: Date.now()
		};
		await saveRoutine(routine);
		routines = await getAllRoutines();
	}

	async function handleDeleteRoutine(id: string) {
		await deleteRoutine(id);
		routines = await getAllRoutines();
	}

	// Auto-save to IndexedDB for today and future plans (past days save
	// explicitly on toggle). Guards: the in-memory state must actually belong
	// to the viewed date (loads are async), and pristine never-saved days are
	// skipped so browsing ahead creates no empty records.
	$effect(() => {
		if (browser && !isLoading && !isViewingPast && loadedDate === selectedDate) {
			const dirty =
				loadedHadSession ||
				tasks.length > 0 ||
				availableHours > 0 ||
				switchCost !== DEFAULT_SWITCH_COST ||
				cognitivePool !== DEFAULT_CAPACITY_POOLS.cognitiveHours ||
				physicalPool !== DEFAULT_CAPACITY_POOLS.physicalHours;
			if (!dirty) return;
			saveSession({
				date: selectedDate,
				tasks: $state.snapshot(tasks),
				availableHours,
				switchCost,
				cognitivePool,
				physicalPool,
				updatedAt: Date.now()
			})
				.then(() => (loadedHadSession = true))
				.catch((e) => console.error('Failed to save session', e));
		}
	});
</script>

<svelte:head>
	<title>Zenith — Smart Daily Time Allocation</title>
	<meta
		name="description"
		content="Zenith allocates your daily time budget across tasks using the Zenith Gradient algorithm — balancing effort, enjoyment, and flow state to maximize productivity."
	/>
	<link rel="canonical" href={page.url.origin + page.url.pathname} />
	<meta name="theme-color" content="#000000" />

	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Zenith" />
	<meta property="og:title" content="Zenith — Smart Daily Time Allocation" />
	<meta
		property="og:description"
		content="Allocate your daily time budget across tasks with the Zenith Gradient algorithm — balancing effort, enjoyment, and flow state to maximize productivity."
	/>
	<meta property="og:url" content={page.url.origin + page.url.pathname} />
	<meta
		property="og:image"
		content={page.url.origin + '/dark-textured-black-background-red-purple.jpg'}
	/>

	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="Zenith — Smart Daily Time Allocation" />
	<meta
		name="twitter:description"
		content="Allocate your daily time budget across tasks with the Zenith Gradient algorithm."
	/>
	<meta
		name="twitter:image"
		content={page.url.origin + '/dark-textured-black-background-red-purple.jpg'}
	/>
</svelte:head>

{#if !isLoading}
	<PageHeader
		completedTasks={completedTasksCount}
		{totalTasks}
		{selectedDate}
		{today}
		ondatechange={gotoDate}
		{yesterdaySession}
		{routines}
		currentTasks={tasks}
		onimport={importTasks}
		onsaveroutine={handleSaveRoutine}
		ondeleteroutine={handleDeleteRoutine}
	/>

	<div class="grid gap-6 lg:grid-cols-3 items-start">
		<div class="space-y-6 lg:col-span-2">
			{#if !isViewingPast}
				{#if isViewingFuture}
					<div
						class="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 text-sky-300/80 text-sm"
					>
						<span class="font-medium">Planning ahead:</span> tasks and budget you set here are
						saved to {formatDisplayDate(selectedDate)} — open it on that day to work the plan.
					</div>
				{/if}
				<TimeBudgetCard
					bind:availableHours
					bind:switchCost
					bind:cognitivePool
					bind:physicalPool
					{remainingSuggestedHours}
					{planSlackHours}
					{modelStatus}
					flowLogs={flowObservations}
					ondeletelog={deleteFlowLog}
					onresetlogs={resetFlowLogs}
				/>
				<TaskForm onsubmit={addTask} />
			{:else}
				<div
					class="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300/80 text-sm"
				>
					<span class="font-medium">Viewing a past day:</span> you can still check tasks on or
					off (forgot one before midnight? fix it here — changes are saved), but adding or
					editing tasks is only possible on today.
				</div>
			{/if}
			<TaskList
				{suggestedTasks}
				{runOrder}
				ontoggle={toggleTask}
				onremove={isViewingPast ? () => {} : removeTask}
				onlogflow={selectedDate === today ? logFlow : undefined}
				onupdate={isViewingPast ? undefined : updateTask}
			/>
		</div>

		<div class="space-y-4 lg:sticky lg:top-8">
			<MetricsDashboard {metrics} momentum={hasTasks ? momentum : null} />
		</div>
	</div>
{/if}
