import type { Task } from '$lib/data/type';
import { DEFAULT_SWITCH_COST, type CapacityPools } from '$lib/business/model/zenith';

/**
 * The worked day a shared link opens on: a visitor arriving cold sees the
 * allocator do something instead of the empty state. Held to what
 * `demo-day.test.ts` claims of it — both pools full, the clock not, and one task
 * the plan refuses to fund — because that is the only reason the day is
 * interesting rather than merely populated.
 *
 * Never persisted: the store seeds it in memory and skips every repository
 * path, so no fabricated task can reach a real profile.
 */

/** The six titles, in fixture order. A tuple so a caller cannot pass five. */
export type DemoTaskTitles = readonly [string, string, string, string, string, string];

/**
 * The model inputs, one per title. Every one is OPEN-ENDED — writing, designing,
 * studying, training, learning a craft — because a fixed-scope errand has no
 * stopping time to solve for: the curve this app allocates against is warm-up
 * then diminishing returns, and a chore you simply have to finish has neither.
 *
 * Three mental-heavy, two physical-heavy, and a last one heavy in BOTH and
 * enjoyable in neither. That last is why the plan seats five tasks and not six:
 * once the two pools are spent, no block of it is affordable.
 */
const DEMO_TASK_INPUTS: readonly Pick<
	Task,
	'physicalDifficulty' | 'mentalDifficulty' | 'enjoyment'
>[] = [
	{
		physicalDifficulty: 2,
		mentalDifficulty: 8,
		enjoyment: 7,
	},
	{
		physicalDifficulty: 1,
		mentalDifficulty: 8,
		enjoyment: 6,
	},
	{
		physicalDifficulty: 2,
		mentalDifficulty: 9,
		enjoyment: 4,
	},
	{
		physicalDifficulty: 9,
		mentalDifficulty: 2,
		enjoyment: 9,
	},
	{
		physicalDifficulty: 8,
		mentalDifficulty: 2,
		enjoyment: 7,
	},
	{
		physicalDifficulty: 7,
		mentalDifficulty: 10,
		enjoyment: 1,
	},
];

/** Long enough that the pools, not the clock, are what stop the plan. */
export const DEMO_AVAILABLE_HOURS = 10;

export const DEMO_SWITCH_COST = DEFAULT_SWITCH_COST;

export const DEMO_POOLS: CapacityPools = {
	cognitiveHours: 3.5,
	physicalHours: 5,
};

/**
 * `titles` arrives from the caller because copy belongs to presentation — the same
 * line `StorageStatusStore` sits on, where `'load-failed'` is a machine value the
 * layout localizes. Nothing FORBIDS `$lib/paraglide` here (it sits beside the
 * three layers, like `logger.ts`); this layer just has no locale in it, and one
 * fixture's titles are a poor reason to give it one. `date` is the viewed day, so
 * the slide column reads day 1 rather than an age.
 *
 * Literal ids rather than `nextTaskId` — the one exception to business/AGENTS.md's
 * id rule, and safe only because nothing here is ever written.
 */
export function buildDemoTasks(titles: DemoTaskTitles, date: string): Task[] {
	return DEMO_TASK_INPUTS.map((input, index) => ({
		...input,
		id: index + 1,
		title: titles[index],
		createdAt: date,
		completed: false,
	}));
}
