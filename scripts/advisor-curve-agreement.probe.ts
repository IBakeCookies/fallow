/**
 * Do the stop advisor (§8.11) and the budget curve (§8.12) contradict each
 * other? Reported from the app: advisor "continue — 2h 15m worth 1.48/h, above
 * your 1.20/h", curve "past 3h another hour of your day adds nothing", on ONE
 * task at P0/M8/E9 in a 6 h window with λ₀ = 1.2.
 *
 * They price different things, and this prints both against the same day so the
 * difference is visible rather than argued:
 *
 *   advisor  — marginal of WORKING the next session, window held fixed
 *   curve    — marginal of LENGTHENING the window, optimizer free to re-solve
 *
 * Usage: npx vitest run --config vitest.probe.config.ts --disableConsoleIntercept scripts/advisor-curve-agreement.probe.ts
 */

import { describe, it } from 'vitest';
import {
	DEFAULT_ENERGY_PARAMS,
	adviseStop,
	optimizeSchedule,
	suggestBudgetCurve,
	type EnergyParams,
} from '$lib/business/model/zenith-energy';
import { DEFAULT_USER_CONSTANTS } from '$lib/business/model/zenith';
import { toEnergyTask } from '$lib/business/model/metric/calculation';
import type { Task } from '$lib/data/type';

const REPORTED: Task = {
	id: 1,
	title: 'Design Error boundary',
	physicalDifficulty: 0,
	mentalDifficulty: 8,
	enjoyment: 9,
	createdAt: '2026-08-08',
	completed: false,
};

// The Model Parameters panel exactly as reported.
const PARAMS: EnergyParams = {
	...DEFAULT_ENERGY_PARAMS,
	alphaCog: 0.25,
	alphaPhys: 0.35,
	recoveryRate: 1,
	freeTimeValue: 1.2,
	terminalEnergyValue: 1.5,
	satietyScale: 1,
	microRecoveryFraction: 0.05,
};

const WINDOW = 6;

const logSession = (hours: number) => ({
	taskId: REPORTED.id,
	hours,
});

describe('stop advisor vs budget curve', () => {
	it('prices the same reported day both ways', () => {
		const tasks = [REPORTED].map(toEnergyTask);
		// What the plan books at the window the user actually has set.
		const atWindow = optimizeSchedule(tasks, WINDOW, PARAMS, DEFAULT_USER_CONSTANTS);

		console.log(
			`plan at the ${WINDOW}h window: books ${atWindow.evaluation.workHours}h, ` +
				`objective ${atWindow.evaluation.objective.toFixed(4)}`,
		);

		// The curve, and what it books at its own recommendation.
		const curve = suggestBudgetCurve(tasks, PARAMS, DEFAULT_USER_CONSTANTS);

		console.log(`curve recommendedHours = ${curve.recommendedHours}`);

		console.log(
			curve.points
				.map(
					(p) =>
						`  b=${p.budgetHours.toFixed(2)} work=${p.workHours.toFixed(2)} ` +
						`day=${p.dayValue.toFixed(4)} v/h=${p.valuePerHour.toFixed(4)}`,
				)
				.join('\n'),
		);

		// The advisor at every point the day could be in, against the same λ₀.
		for (let logged = 0; logged <= 4.5; logged += 0.75) {
			const advice = adviseStop(
				{
					tasks,
					windowHours: WINDOW,
					workedHours: logged > 0 ? [logSession(logged)] : [],
				},
				PARAMS,
				DEFAULT_USER_CONSTANTS,
			);

			if (advice === null) {
				console.log(`logged ${logged.toFixed(2)}h -> no advice`);
				continue;
			}

			if (advice.verdict === 'window-full') {
				console.log(`logged ${logged.toFixed(2)}h -> window-full`);
				continue;
			}

			console.log(
				`logged ${logged.toFixed(2)}h -> ${advice.verdict}: ` +
					`next session ${advice.sessionHours.toFixed(2)}h at ` +
					`${advice.marginalValue.toFixed(4)}/h vs λ₀ ${PARAMS.freeTimeValue} ` +
					`(total would be ${(logged + advice.sessionHours).toFixed(2)}h)`,
			);
		}
	});
});
