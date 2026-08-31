import { expect, it } from 'vitest';
import {
	DEMO_AVAILABLE_HOURS,
	DEMO_POOLS,
	DEMO_SWITCH_COST,
	buildDemoTasks,
} from '$lib/business/demo-day';
import {
	calculateTaskPlan,
	calculateZenithGain,
	toPooledInputs,
} from '$lib/business/model/metric/calculation';
import { BLOCK_HOURS } from '$lib/business/model/zenith';

/**
 * The fixture is the whole claim: a shared link is the first Fallow anyone sees,
 * so the day it opens on has to be one where the allocator visibly does
 * something — the pools run out before the clock does, and one task is left
 * unfunded because of it. Tuning belongs in the fixture; these bounds do not
 * move with it.
 */
const tasks = buildDemoTasks(['one', 'two', 'three', 'four', 'five', 'six'], '2026-08-31');
const plan = calculateTaskPlan(tasks, DEMO_AVAILABLE_HOURS, DEMO_SWITCH_COST, DEMO_POOLS);

const draw = toPooledInputs(tasks).reduce(
	(total, task, index) => ({
		cognitiveHours: total.cognitiveHours + task.cognitiveWeight * plan.allocatedHours[index],
		physicalHours: total.physicalHours + task.physicalWeight * plan.allocatedHours[index],
	}),
	{
		cognitiveHours: 0,
		physicalHours: 0,
	},
);

it('draws the cognitive pool to within a block of its ceiling', () => {
	expect(draw.cognitiveHours).toBeGreaterThan(DEMO_POOLS.cognitiveHours - BLOCK_HOURS);
	expect(draw.cognitiveHours).toBeLessThanOrEqual(DEMO_POOLS.cognitiveHours);
});

it('draws the physical pool to within a block of its ceiling', () => {
	expect(draw.physicalHours).toBeGreaterThan(DEMO_POOLS.physicalHours - BLOCK_HOURS);
	expect(draw.physicalHours).toBeLessThanOrEqual(DEMO_POOLS.physicalHours);
});

// Without this the two above say nothing: a plan that spent its whole clock is
// bound by the clock, and the pools only happen to be full.
it('leaves the clock with hours the pools will not let it spend', () => {
	const funded = plan.allocatedHours.filter((hours) => hours > 0).length;

	const spent =
		plan.allocatedHours.reduce((total, hours) => total + hours, 0) +
		Math.max(0, funded - 1) * DEMO_SWITCH_COST;

	expect(spent).toBeLessThanOrEqual(DEMO_AVAILABLE_HOURS - BLOCK_HOURS);
});

it('funds every task but one', () => {
	expect(plan.allocatedHours.filter((hours) => hours === 0)).toHaveLength(1);
});

it('beats the equal split it is shown against', () => {
	const gain = calculateZenithGain(
		tasks,
		DEMO_AVAILABLE_HOURS,
		DEMO_SWITCH_COST,
		DEMO_POOLS,
		undefined,
		undefined,
		plan.allocatedHours,
	);

	expect(gain.gainPercent).toBeGreaterThan(0);
});
