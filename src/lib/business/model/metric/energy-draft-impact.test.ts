import { describe, expect, it } from 'vitest';
import {
	calculateEnergyDraftImpact,
	type EnergyDraftImpactInput,
} from '$lib/business/model/metric/energy-draft-impact';
import type { DraftTask } from '$lib/business/model/metric/draft-impact';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import {
	DEFAULT_ENERGY_PARAMS,
	optimizeSchedule,
	type ScheduleEvaluation,
} from '$lib/business/model/zenith-energy';
import type { Task } from '$lib/data/type';

function makeTask(overrides: Partial<Task> & { id: number; title: string }): Task {
	return {
		physicalDifficulty: 5,
		mentalDifficulty: 5,
		enjoyment: 5,
		createdAt: '2026-09-03',
		completed: false,
		...overrides,
	};
}

function input(tasks: Task[], windowHours: number): EnergyDraftImpactInput {
	return {
		tasks,
		windowHours,
		params: DEFAULT_ENERGY_PARAMS,
		constants: DEFAULT_USER_CONSTANTS,
	};
}

function solve(tasks: Task[], windowHours: number) {
	return optimizeSchedule(
		tasks.map(toEnergyTask),
		windowHours,
		DEFAULT_ENERGY_PARAMS,
		DEFAULT_USER_CONSTANTS,
	);
}

function price(tasks: Task[], draft: DraftTask, windowHours: number) {
	return calculateEnergyDraftImpact(input(tasks, windowHours), draft, solve(tasks, windowHours));
}

/* Every day-level expectation is read off the day typed out with the draft
   DEPLOYED as a real task — the same reason `draft-impact.test.ts` does it: the
   reading is only worth showing if it is the plan the user is about to get. */
function deploy(tasks: Task[], draft: DraftTask, windowHours: number): ScheduleEvaluation {
	return solve(
		[
			makeTask({
				id: 99,
				title: 'Boxing training',
				...draft,
			}),
			...tasks,
		],
		windowHours,
	).evaluation;
}

const WRITE_SPEC = makeTask({
	id: 1,
	title: 'Write spec',
	mentalDifficulty: 8,
	physicalDifficulty: 1,
	enjoyment: 7,
});

const GYM = makeTask({
	id: 2,
	title: 'Gym',
	mentalDifficulty: 1,
	physicalDifficulty: 8,
	enjoyment: 4,
});

const WRITE_REPORT = makeTask({
	id: 3,
	title: 'Write report',
	mentalDifficulty: 6,
	physicalDifficulty: 2,
	enjoyment: 3,
});

const THREE = [WRITE_SPEC, GYM, WRITE_REPORT];

/* Five, because the pair seeds are drawn from the four highest-amplitude tasks:
   a draft that enters that set changes which plans the search starts from, so a
   day this size is the only one where an UNFUNDED draft moves the plan at all. */
const FIVE = [
	...THREE,
	makeTask({
		id: 4,
		title: 'Groceries',
		mentalDifficulty: 2,
		physicalDifficulty: 5,
		enjoyment: 6,
	}),
	makeTask({
		id: 5,
		title: 'Guitar',
		mentalDifficulty: 3,
		physicalDifficulty: 3,
		enjoyment: 9,
	}),
];

/** Funded on an 8 h day, and not in its first block. */
const FUNDED: DraftTask = {
	physicalDifficulty: 6,
	mentalDifficulty: 2,
	enjoyment: 5,
};

/** Outvalues the day's own tasks — the draft that costs them hours. */
const STRONG: DraftTask = {
	physicalDifficulty: 8,
	mentalDifficulty: 3,
	enjoyment: 9,
};

/** Too dull for the optimizer to spend a block on. */
const DULL: DraftTask = {
	physicalDifficulty: 0,
	mentalDifficulty: 10,
	enjoyment: 1,
};

describe('calculateEnergyDraftImpact', () => {
	it('reports the hours the optimizer funds and where they start', () => {
		const impact = price(THREE, FUNDED, 8)!;

		expect(impact.suggestedHours).toBeCloseTo(2.25, 10);
		expect(impact.startHour).toBeCloseTo(5.25, 10);
	});

	it('gives an unfunded draft no slot at all', () => {
		const impact = price(FIVE, DULL, 5)!;

		expect(impact.suggestedHours).toBe(0);
		expect(impact.startHour).toBeNull();
	});

	it('reads Total Output before and after', () => {
		const impact = price(THREE, FUNDED, 8)!;

		expect(impact.totalOutput.before).toBeCloseTo(solve(THREE, 8).evaluation.totalOutput, 10);
		expect(impact.totalOutput.after).toBeCloseTo(deploy(THREE, FUNDED, 8).totalOutput, 10);
	});

	// The WORKED end and not the window's end: how spent the plan leaves you is
	// the pair `PlanSummary` prints above this form.
	it('reads the end-of-day energy before and after', () => {
		const impact = price(THREE, FUNDED, 8)!;
		const baseline = solve(THREE, 8).evaluation;
		const drafted = deploy(THREE, FUNDED, 8);

		expect(impact.endCog.before).toBeCloseTo(baseline.workEndCog, 10);
		expect(impact.endPhys.before).toBeCloseTo(baseline.workEndPhys, 10);
		expect(impact.endCog.after).toBeCloseTo(drafted.workEndCog, 10);
		expect(impact.endPhys.after).toBeCloseTo(drafted.workEndPhys, 10);
	});

	it('thins the day’s other tasks by the hours the draft takes', () => {
		const impact = price(THREE, STRONG, 12)!;

		expect(impact.displaced.hoursTaken).toBeCloseTo(4.5, 10);
		expect(impact.displaced.taskCount).toBe(2);
	});

	it('names the tasks the draft drops', () => {
		const impact = price(THREE, STRONG, 6)!;

		expect(impact.displaced.unfunded).toEqual(['Gym']);
	});

	// A completed task keeps its hours and will not be re-worked, so naming one as
	// displaced is a phantom.
	it('never displaces a completed task', () => {
		const groceries = makeTask({
			id: 4,
			title: 'Groceries',
			mentalDifficulty: 2,
			physicalDifficulty: 6,
			enjoyment: 8,
			completed: true,
		});

		const impact = price([WRITE_SPEC, groceries], STRONG, 4)!;

		expect(impact.displaced.unfunded).toEqual(['Write spec']);
		expect(impact.displaced.hoursTaken).toBeCloseTo(1.5, 10);
	});

	/* The optimizer is a seeded local search, so a candidate it funds nothing for
	   can still move the plan it lands on — this day is one where it does. That
	   movement is the search's, not the draft's, and reading it as a cost would
	   name hours the day is not buying. */
	it('takes nothing for an unfunded draft, even where the plan moves under it', () => {
		const impact = price(FIVE, DULL, 5)!;

		expect(impact.displaced).toEqual({
			hoursTaken: 0,
			taskCount: 0,
			unfunded: [],
		});
	});

	it('returns null for a day with no window', () => {
		expect(price(THREE, STRONG, 0)).toBeNull();
	});
});
