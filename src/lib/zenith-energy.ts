/**
 * Zenith Energy Model (experimental — powers the /energy route)
 *
 * A schedule-level alternative to the classic allocator in `zenith.ts`. Instead
 * of maximizing a sum of average productivity *rates*, this model maximizes
 * TOTAL OUTPUT over the day, which only becomes well-posed once fatigue and
 * the value of not-working enter the picture:
 *
 * - Two energy reservoirs C_cog, C_phys ∈ [0,1] evolve while you work or rest:
 *       dC/dτ = −α·w·C + r·(1−w)·(1−C)
 *   where w is the task's demand on that reservoir (0–1), α its drain rate and
 *   r the recovery rate. Piecewise-constant coefficients per block give a
 *   closed-form exponential trajectory — no ODE solver.
 *
 * - Warm-up is PER SESSION: productivity p(s) = (a+p₀)·k·s·e^(−ks) uses time
 *   since the current contiguous block started. Switching tasks (or resting)
 *   resets s to 0. This is what makes fragmentation genuinely costly — without
 *   the reset, slicing work into confetti would be optimal under total output.
 *
 * - Instantaneous output = p(s) · C_cog^wc · C_phys^wp (Cobb-Douglas gate):
 *   a drained reservoir throttles exactly the tasks that demand it.
 *
 * - Objective = Σ block outputs
 *             + freeTimeValue · (hours not worked inside the window)
 *             + terminalEnergyValue · (C_cog(T) + C_phys(T)) / 2.
 *   Fatigue alone never stops a total-output maximizer (p·gate stays > 0), so
 *   the two value terms provide the stopping incentive: leisure has a price
 *   per hour, and ending the day fresh is worth something.
 *
 * The optimizer is a deterministic multi-seed local search over block
 * schedules (task-or-rest, duration) — not slot-greedy (myopic: never rests)
 * and not full DP (state space explodes).
 *
 * This file is intentionally standalone: it shares the curve/ϕ machinery with
 * the classic model but none of its allocation code, so the main page is
 * untouched by anything here.
 */

import {
	calculateFlowStateTime,
	mapEffort,
	mapEnjoyability,
	OPTIMAL_PHI_MULTIPLIER,
	DEFAULT_USER_CONSTANTS,
	type UserConstants
} from './zenith';

// ================== Types & defaults ==================

export interface EnergyTaskInput {
	id: number;
	title: string;
	/** Effective difficulty Eᵤ (1–10), spillover-combined like the classic model */
	difficulty: number;
	/** Enjoyment βᵤ (1–10) */
	enjoyment: number;
	/** Demand on the cognitive reservoir, 0–1 (mentalDifficulty / 10) */
	cognitiveDemand: number;
	/** Demand on the physical reservoir, 0–1 (physicalDifficulty / 10) */
	physicalDemand: number;
}

export interface EnergyParams {
	/** Cognitive drain rate per hour at full demand (w = 1) */
	alphaCog: number;
	/** Physical drain rate per hour at full demand */
	alphaPhys: number;
	/** Recovery rate per hour toward full energy when a reservoir is idle */
	recoveryRate: number;
	/** Output-value of one hour NOT worked (leisure opportunity cost of working) */
	freeTimeValue: number;
	/** Output-value of ending the window at full vs empty energy (both reservoirs averaged) */
	terminalEnergyValue: number;
	/** Starting energy levels, 0–1 */
	initialCog: number;
	initialPhys: number;
}

export const DEFAULT_ENERGY_PARAMS: EnergyParams = {
	// e^(−0.35·2) ≈ 0.5: two hours of full-demand deep work halves the reservoir.
	alphaCog: 0.35,
	alphaPhys: 0.3,
	// From half energy, one hour of rest recovers to 1 − 0.5e^(−0.7) ≈ 0.75.
	recoveryRate: 0.7,
	freeTimeValue: 0.5,
	terminalEnergyValue: 1.5,
	initialCog: 1,
	initialPhys: 1
};

/** One schedule entry: a contiguous run on a task, or rest (taskId = null). */
export interface ScheduleBlock {
	taskId: number | null;
	hours: number;
}

export interface EvaluatedBlock extends ScheduleBlock {
	title: string;
	start: number;
	output: number;
	cogAfter: number;
	physAfter: number;
}

export interface ScheduleEvaluation {
	blocks: EvaluatedBlock[];
	totalOutput: number;
	workHours: number;
	/** Window hours not worked (explicit rest + trailing free time) */
	leisureHours: number;
	freeTimeBonus: number;
	terminalBonus: number;
	/** totalOutput + freeTimeBonus + terminalBonus — what the optimizer maximizes */
	objective: number;
	endCog: number;
	endPhys: number;
}

export interface TrajectoryPoint {
	t: number;
	cog: number;
	phys: number;
	/** Instantaneous gated output rate (0 while resting/idle) */
	rate: number;
	taskId: number | null;
}

// ================== Task curves ==================

interface TaskCurve {
	id: number;
	title: string;
	amp: number; // a + p₀
	k: number; // 1/ϕ
	phi: number;
	wc: number;
	wp: number;
}

function buildCurves(
	tasks: EnergyTaskInput[],
	constants: UserConstants
): Map<number, TaskCurve> {
	const curves = new Map<number, TaskCurve>();
	for (const task of tasks) {
		const E = mapEffort(task.difficulty);
		const beta = mapEnjoyability(task.enjoyment);
		const phi = calculateFlowStateTime(E, beta, constants);
		curves.set(task.id, {
			id: task.id,
			title: task.title,
			amp: E * beta + beta / E,
			k: 1 / phi,
			phi,
			wc: clamp01(task.cognitiveDemand),
			wp: clamp01(task.physicalDemand)
		});
	}
	return curves;
}

function clamp01(x: number): number {
	return Math.min(1, Math.max(0, x));
}

// ================== Reservoir dynamics (closed form) ==================

/**
 * dC/dτ = −α·w·C + r·(1−w)·(1−C) is linear with constant coefficients:
 * C(τ) = C_eq + (C₀ − C_eq)·e^(−ρτ), ρ = α·w + r·(1−w), C_eq = r·(1−w)/ρ.
 */
interface ReservoirLaw {
	rho: number;
	eq: number;
}

function reservoirLaw(demand: number, alpha: number, recovery: number): ReservoirLaw {
	const rho = alpha * demand + recovery * (1 - demand);
	// ρ = 0 only when both terms vanish; the reservoir then holds its level and
	// eq is never used (reservoirAt short-circuits).
	return { rho, eq: rho > 0 ? (recovery * (1 - demand)) / rho : 0 };
}

function reservoirAt(c0: number, law: ReservoirLaw, t: number): number {
	if (law.rho <= 0 || t <= 0) return c0;
	return law.eq + (c0 - law.eq) * Math.exp(-law.rho * t);
}

// ================== Block output ==================

/**
 * ∫₀ᴰ p(s)·C_cog(s)^wc·C_phys(s)^wp ds via composite Simpson. The reservoir
 * factors are closed-form, so only the quadrature is numeric. The node count
 * scales with the fastest timescale in the integrand (ϕ or 1/ρ) so short-flow
 * tasks inside long blocks are still resolved.
 */
function blockOutput(
	curve: TaskCurve,
	cog0: number,
	phys0: number,
	lawC: ReservoirLaw,
	lawP: ReservoirLaw,
	hours: number
): number {
	if (hours <= 0) return 0;
	const fastest = Math.min(
		curve.phi,
		lawC.rho > 0 ? 1 / lawC.rho : Infinity,
		lawP.rho > 0 ? 1 / lawP.rho : Infinity,
		hours
	);
	// Simpson error ~ h⁴: 16 nodes per fastest timescale keeps relative error
	// below ~1e-6 even for near-floor ϕ tasks inside long blocks (probe-verified).
	let n = Math.ceil(hours / (fastest / 16));
	n = Math.min(Math.max(n, 16), 1024);
	if (n % 2 === 1) n++;

	const h = hours / n;
	let sum = 0;
	for (let j = 0; j <= n; j++) {
		const s = j * h;
		const p = curve.amp * curve.k * s * Math.exp(-curve.k * s);
		const gate =
			Math.pow(reservoirAt(cog0, lawC, s), curve.wc) *
			Math.pow(reservoirAt(phys0, lawP, s), curve.wp);
		const w = j === 0 || j === n ? 1 : j % 2 === 1 ? 4 : 2;
		sum += w * p * gate;
	}
	return (sum * h) / 3;
}

// ================== Schedule evaluation ==================

/**
 * Canonical form: clip to the window, drop empty blocks, merge adjacent blocks
 * on the same task (a merged run is ONE session — the merge is what preserves
 * warm-up), and drop trailing rest (the tail of the window is implicit rest).
 */
export function normalizeSchedule(
	blocks: ScheduleBlock[],
	windowHours: number
): ScheduleBlock[] {
	const out: ScheduleBlock[] = [];
	let used = 0;
	for (const b of blocks) {
		const hours = Math.min(b.hours, windowHours - used);
		if (hours <= 1e-9) continue;
		const prev = out[out.length - 1];
		if (prev && prev.taskId === b.taskId) prev.hours += hours;
		else out.push({ taskId: b.taskId, hours });
		used += hours;
	}
	while (out.length > 0 && out[out.length - 1].taskId === null) out.pop();
	return out;
}

export function evaluateSchedule(
	blocksIn: ScheduleBlock[],
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams = DEFAULT_ENERGY_PARAMS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS
): ScheduleEvaluation {
	const curves = buildCurves(tasks, constants);
	const blocks = normalizeSchedule(blocksIn, windowHours).filter(
		(b) => b.taskId === null || curves.has(b.taskId)
	);

	const restLawC = reservoirLaw(0, params.alphaCog, params.recoveryRate);
	const restLawP = reservoirLaw(0, params.alphaPhys, params.recoveryRate);

	let cog = clamp01(params.initialCog);
	let phys = clamp01(params.initialPhys);
	let t = 0;
	let totalOutput = 0;
	let workHours = 0;
	const evaluated: EvaluatedBlock[] = [];

	for (const b of blocks) {
		if (b.taskId === null) {
			cog = reservoirAt(cog, restLawC, b.hours);
			phys = reservoirAt(phys, restLawP, b.hours);
			evaluated.push({
				taskId: null,
				title: 'Rest',
				start: t,
				hours: b.hours,
				output: 0,
				cogAfter: cog,
				physAfter: phys
			});
		} else {
			const curve = curves.get(b.taskId)!;
			const lawC = reservoirLaw(curve.wc, params.alphaCog, params.recoveryRate);
			const lawP = reservoirLaw(curve.wp, params.alphaPhys, params.recoveryRate);
			const output = blockOutput(curve, cog, phys, lawC, lawP, b.hours);
			totalOutput += output;
			workHours += b.hours;
			cog = reservoirAt(cog, lawC, b.hours);
			phys = reservoirAt(phys, lawP, b.hours);
			evaluated.push({
				taskId: b.taskId,
				title: curve.title,
				start: t,
				hours: b.hours,
				output,
				cogAfter: cog,
				physAfter: phys
			});
		}
		t += b.hours;
	}

	// Whatever remains of the window is implicit rest before the terminal
	// valuation — stopping early both earns leisure and recovers energy.
	const tail = windowHours - t;
	if (tail > 0) {
		cog = reservoirAt(cog, restLawC, tail);
		phys = reservoirAt(phys, restLawP, tail);
	}

	const leisureHours = Math.max(0, windowHours - workHours);
	const freeTimeBonus = params.freeTimeValue * leisureHours;
	const terminalBonus = (params.terminalEnergyValue * (cog + phys)) / 2;

	return {
		blocks: evaluated,
		totalOutput,
		workHours,
		leisureHours,
		freeTimeBonus,
		terminalBonus,
		objective: totalOutput + freeTimeBonus + terminalBonus,
		endCog: cog,
		endPhys: phys
	};
}

// ================== Trajectory sampling (for charts) ==================

export function sampleTrajectory(
	blocksIn: ScheduleBlock[],
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams = DEFAULT_ENERGY_PARAMS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	dtHours: number = 0.05
): TrajectoryPoint[] {
	const curves = buildCurves(tasks, constants);
	const blocks = normalizeSchedule(blocksIn, windowHours).filter(
		(b) => b.taskId === null || curves.has(b.taskId)
	);
	const restLawC = reservoirLaw(0, params.alphaCog, params.recoveryRate);
	const restLawP = reservoirLaw(0, params.alphaPhys, params.recoveryRate);

	const points: TrajectoryPoint[] = [];
	let cog = clamp01(params.initialCog);
	let phys = clamp01(params.initialPhys);
	let t = 0;

	const sampleSegment = (
		hours: number,
		curve: TaskCurve | null,
		lawC: ReservoirLaw,
		lawP: ReservoirLaw
	) => {
		const steps = Math.max(1, Math.ceil(hours / dtHours));
		for (let j = 0; j < steps; j++) {
			const s = (j * hours) / steps;
			const c = reservoirAt(cog, lawC, s);
			const p = reservoirAt(phys, lawP, s);
			const rate = curve
				? curve.amp *
					curve.k *
					s *
					Math.exp(-curve.k * s) *
					Math.pow(c, curve.wc) *
					Math.pow(p, curve.wp)
				: 0;
			points.push({ t: t + s, cog: c, phys: p, rate, taskId: curve?.id ?? null });
		}
		cog = reservoirAt(cog, lawC, hours);
		phys = reservoirAt(phys, lawP, hours);
		t += hours;
	};

	for (const b of blocks) {
		if (b.taskId === null) {
			sampleSegment(b.hours, null, restLawC, restLawP);
		} else {
			const curve = curves.get(b.taskId)!;
			sampleSegment(
				b.hours,
				curve,
				reservoirLaw(curve.wc, params.alphaCog, params.recoveryRate),
				reservoirLaw(curve.wp, params.alphaPhys, params.recoveryRate)
			);
		}
	}
	if (windowHours - t > 0) sampleSegment(windowHours - t, null, restLawC, restLawP);
	points.push({ t: windowHours, cog, phys, rate: 0, taskId: null });
	return points;
}

// ================== Optimizer: multi-seed local search ==================

export interface OptimizeOptions {
	/** Duration granularity of search moves (hours). Default 0.25. */
	stepHours?: number;
	/** Safety cap on hill-climb iterations per seed. Default 300. */
	maxIterations?: number;
}

export interface OptimizeResult {
	blocks: ScheduleBlock[];
	evaluation: ScheduleEvaluation;
}

/**
 * Deterministic steepest-ascent hill climb from several structurally different
 * seeds; the best local optimum wins. Moves: grow/shrink/remove a block,
 * reassign its task (or turn it into rest), swap adjacent blocks, insert a new
 * task/rest block at any boundary, and split a block around a rest break.
 */
export function optimizeSchedule(
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams = DEFAULT_ENERGY_PARAMS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	options: OptimizeOptions = {}
): OptimizeResult {
	const step = options.stepHours ?? 0.25;
	const maxIterations = options.maxIterations ?? 300;

	const emptyEval = evaluateSchedule([], tasks, windowHours, params, constants);
	if (windowHours <= 0 || tasks.length === 0) {
		return { blocks: [], evaluation: emptyEval };
	}

	let best: ScheduleBlock[] = [];
	let bestEval = emptyEval;
	for (const seed of buildSeeds(tasks, windowHours, constants)) {
		const result = localSearch(seed, tasks, windowHours, params, constants, step, maxIterations);
		if (result.evaluation.objective > bestEval.objective + 1e-9) {
			best = result.blocks;
			bestEval = result.evaluation;
		}
	}
	return { blocks: best, evaluation: bestEval };
}

function buildSeeds(
	tasks: EnergyTaskInput[],
	windowHours: number,
	constants: UserConstants
): ScheduleBlock[][] {
	const phiOf = (task: EnergyTaskInput) =>
		calculateFlowStateTime(mapEffort(task.difficulty), mapEnjoyability(task.enjoyment), constants);
	const ampOf = (task: EnergyTaskInput) => {
		const E = mapEffort(task.difficulty);
		const beta = mapEnjoyability(task.enjoyment);
		return E * beta + beta / E;
	};
	const byValue = [...tasks].sort((x, y) => ampOf(y) - ampOf(x));

	// Seed 1: classic-flavored — each task once at its single-task optimum,
	// best tasks first, until the window is spent.
	const classic: ScheduleBlock[] = [];
	let left = windowHours;
	for (const task of byValue) {
		if (left <= 0) break;
		const hours = Math.min(OPTIMAL_PHI_MULTIPLIER * phiOf(task), left);
		classic.push({ taskId: task.id, hours });
		left -= hours;
	}

	// Seed 2: all-in on the single best task.
	const allIn: ScheduleBlock[] = [{ taskId: byValue[0].id, hours: windowHours }];

	// Seed 3: round-robin hour blocks (a deliberately fragmented start so the
	// search also explores from the interleaved side).
	const roundRobin: ScheduleBlock[] = [];
	left = windowHours;
	for (let i = 0; left > 1e-9 && i < 24; i++) {
		const task = byValue[i % byValue.length];
		const hours = Math.min(1, left);
		roundRobin.push({ taskId: task.id, hours });
		left -= hours;
	}

	// Seed 4: empty (all leisure) — lets the search justify every worked hour.
	return [classic, allIn, roundRobin, []];
}

function localSearch(
	seed: ScheduleBlock[],
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams,
	constants: UserConstants,
	step: number,
	maxIterations: number
): OptimizeResult {
	let current = normalizeSchedule(seed, windowHours);
	let currentEval = evaluateSchedule(current, tasks, windowHours, params, constants);

	for (let iter = 0; iter < maxIterations; iter++) {
		let improved: { blocks: ScheduleBlock[]; evaluation: ScheduleEvaluation } | null = null;
		for (const candidate of neighbors(current, tasks, windowHours, step)) {
			const evaluation = evaluateSchedule(candidate, tasks, windowHours, params, constants);
			if (evaluation.objective > (improved?.evaluation.objective ?? currentEval.objective) + 1e-9) {
				improved = { blocks: candidate, evaluation };
			}
		}
		if (!improved) break;
		current = normalizeSchedule(improved.blocks, windowHours);
		currentEval = improved.evaluation;
	}
	return { blocks: current, evaluation: currentEval };
}

function* neighbors(
	blocks: ScheduleBlock[],
	tasks: EnergyTaskInput[],
	windowHours: number,
	step: number
): Generator<ScheduleBlock[]> {
	const total = blocks.reduce((sum, b) => sum + b.hours, 0);
	const room = windowHours - total > step - 1e-9;

	for (let i = 0; i < blocks.length; i++) {
		if (room) yield replaceAt(blocks, i, { ...blocks[i], hours: blocks[i].hours + step });
		yield replaceAt(blocks, i, { ...blocks[i], hours: blocks[i].hours - step });
		yield [...blocks.slice(0, i), ...blocks.slice(i + 1)];
		if (i + 1 < blocks.length) {
			const swapped = [...blocks];
			[swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
			yield swapped;
		}
		for (const task of tasks) {
			if (task.id !== blocks[i].taskId) yield replaceAt(blocks, i, { ...blocks[i], taskId: task.id });
		}
		if (blocks[i].taskId !== null) yield replaceAt(blocks, i, { ...blocks[i], taskId: null });
		// Split around a rest break: tests whether a mid-session recovery pays
		// for the warm-up it destroys.
		if (blocks[i].taskId !== null && blocks[i].hours >= 2 * step && room) {
			const half = blocks[i].hours / 2;
			yield [
				...blocks.slice(0, i),
				{ taskId: blocks[i].taskId, hours: half },
				{ taskId: null, hours: step },
				{ taskId: blocks[i].taskId, hours: half },
				...blocks.slice(i + 1)
			];
		}
	}

	for (let pos = 0; pos <= blocks.length; pos++) {
		if (!room) break;
		for (const task of tasks) {
			yield [...blocks.slice(0, pos), { taskId: task.id, hours: step }, ...blocks.slice(pos)];
		}
		yield [...blocks.slice(0, pos), { taskId: null, hours: step }, ...blocks.slice(pos)];
	}
}

function replaceAt(
	blocks: ScheduleBlock[],
	index: number,
	block: ScheduleBlock
): ScheduleBlock[] {
	const next = [...blocks];
	next[index] = block;
	return next;
}
