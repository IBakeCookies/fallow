/**
 * Zenith Energy Model (experimental — powers the /energy route)
 *
 * A schedule-level alternative to the classic allocator in `zenith.ts`. Instead
 * of maximizing a sum of average productivity *rates*, this model maximizes
 * TOTAL OUTPUT over the day, which only becomes well-posed once fatigue and
 * the value of not-working enter the picture:
 *
 * - Two energy reservoirs C_cog, C_phys ∈ [0,1] evolve while you work or rest:
 *       dC/dτ = −α·w·C + r·(1−(1−b)·w)·(1−C)
 *   where w is the task's demand on that reservoir (0–1), α its drain rate, r
 *   the recovery rate and b the micro-recovery fraction — the share of recovery
 *   capacity that stays active even at full demand, so a w = 1 task drains
 *   toward a positive floor instead of exactly zero (MATH.md §8.5). Piecewise-
 *   constant coefficients per block give a closed-form exponential trajectory —
 *   no ODE solver.
 *
 * - Warm-up is PER TASK with decaying carryover: productivity is
 *   p(s) = (a+p₀)·k·s·e^(−ks), where s is the SESSION PHASE — time
 *   accumulated on that task, not clock time. Leaving a task for a gap g and
 *   returning resumes at s·e^(−g/τ) rather than 0 (Monk/Trafton memory-for-
 *   goals) — a brief switch costs little warm-up, a long gap approaches a cold
 *   restart. Because p(s) is hump-shaped, this one decay does double duty:
 *   below the peak it models lost warm-up (breaks hurt), above it models
 *   boredom relief (a break moves you back toward peak). Fragmentation is still
 *   costly, just no longer catastrophic the way a hard reset made it.
 *
 * - Instantaneous output = p(s) · C_cog^wc · C_phys^wp (Cobb-Douglas gate):
 *   a drained reservoir throttles exactly the tasks that demand it.
 *
 * - SATIETY (per-task diminishing daily returns): each task's raw daily
 *   output O is valued through the concave wrapper V(O) = κ·ln(1 + O/κ),
 *   κ = satietyScale · (that task's reference single-session output over T*).
 *   Without it the model is winner-take-all: a second session on the best
 *   task gets a fresh warm-up curve at zero cost, so re-running it always
 *   beats switching to a weaker task (probe-verified 2026-07-11). Satiety is
 *   keyed to cumulative OUTPUT — not the session phase, which decays over
 *   gaps — so breaks cannot launder it away. Derivation and the rejected
 *   alternative forms are in MATH.md §8.4.
 *
 * - Objective = Σ_tasks V(task's summed block outputs)
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
	/**
	 * Intermittent-task recovery correction (Xia & Frey Law 2008; Looft, Herkert
	 * & Frey Law 2018). The base drain/recovery law over-predicts fatigue when
	 * rest is interspersed with work, because recovery of an idle reservoir is
	 * empirically faster than a single fixed rate predicts. This multiplies the
	 * recovery coefficient; the (1−demand) gate concentrates the boost where the
	 * reservoir is actually idle (full at rest, none at full demand). 1 disables it.
	 */
	restRecoveryMultiplier: number;
	/**
	 * Micro-recovery fraction b: the share of recovery capacity that stays
	 * active even while working at full demand (micro-pauses between efforts —
	 * the same intermittent-effort regime as restRecoveryMultiplier). The
	 * recovery gate becomes 1−(1−b)·w instead of 1−w, so a w = 1 task drains
	 * toward the floor b·r′/(α + b·r′) > 0 instead of exactly 0. Without it,
	 * full-demand tasks sit on a knife edge: demand 10 vs 9.5 flips the plan
	 * (probe-verified 2026-07-14). 0 disables, recovering the pure (1−w) gate.
	 * MATH.md §8.5.
	 */
	microRecoveryFraction: number;
	/**
	 * Warm-up / task-state retention time constant, hours (Monk, Trafton &
	 * Boehm-Davis 2008 memory-for-goals). Resuming a task after being away for a
	 * gap g keeps a fraction e^(−g/resumptionTimeConstant) of the session phase
	 * built up before — so a brief switch costs little warm-up while a long gap
	 * approaches a cold restart. ≤0 reproduces the old binary reset.
	 */
	resumptionTimeConstant: number;
	/**
	 * Per-task diminishing daily returns. A task's raw daily output O is valued
	 * as V(O) = κ·ln(1 + O/κ) with κ = satietyScale · O_ref, where O_ref is the
	 * task's reference single-session output (fresh reservoirs, one contiguous
	 * T* = 1.7933·ϕ run). At O = κ the marginal value of further output on that
	 * task has fallen to ½, so a satiated task loses to a fresh one — this is
	 * what breaks the winner-take-all pathology. ≤0 disables (V = identity),
	 * recovering the pure total-output objective. MATH.md §8.4.
	 */
	satietyScale: number;
	/** Starting energy levels, 0–1 */
	initialCog: number;
	initialPhys: number;
}

export const DEFAULT_ENERGY_PARAMS: EnergyParams = {
	// e^(−0.35·2) ≈ 0.5: two hours of full-demand deep work halves the reservoir.
	alphaCog: 0.35,
	alphaPhys: 0.3,
	// Base recovery coefficient. With restRecoveryMultiplier below, an idle
	// reservoir refills at 0.7·1.5 = 1.05/h: one hour of rest from half energy
	// recovers to 1 − 0.5·e^(−1.05) ≈ 0.825.
	recoveryRate: 0.7,
	restRecoveryMultiplier: 1.5,
	// b = 0.05 → w = 1 floor ≈ 0.15 (phys) / 0.13 (cog): the Rohmert (1960)
	// ~15% MVC threshold below which static effort is sustainable indefinitely.
	microRecoveryFraction: 0.05,
	// After 30 min away e^(−0.5/0.5) ≈ 0.37 of warm-up survives; after 5 min,
	// ≈ 0.85. Coffee-break-scale gaps cost little; a lunch-scale gap resets you.
	resumptionTimeConstant: 0.5,
	// κ = 1·O_ref: after one good session's worth of output, further output on
	// the same task is worth half at the margin (probe-verified 2026-07-14 to
	// turn the winner-take-all default plan into one session per task).
	satietyScale: 1,
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
	/** Raw physical output Σ block outputs, before the satiety wrapper */
	totalOutput: number;
	/** Σ_tasks V(task's summed output) — equals totalOutput when satiety is off */
	satiatedOutput: number;
	workHours: number;
	/** Window hours not worked (explicit rest + trailing free time) */
	leisureHours: number;
	freeTimeBonus: number;
	terminalBonus: number;
	/** satiatedOutput + freeTimeBonus + terminalBonus — what the optimizer maximizes */
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
	/**
	 * Reference single-session output: one contiguous T* = 1.7933·ϕ run from
	 * FULL reservoirs (a standardized yardstick, deliberately independent of
	 * initialCog/initialPhys). Sets the satiety scale κ = satietyScale·refOutput,
	 * so satiety auto-scales with how much a good session on this task yields.
	 */
	refOutput: number;
}

function buildCurves(
	tasks: EnergyTaskInput[],
	constants: UserConstants,
	params: EnergyParams
): Map<number, TaskCurve> {
	const curves = new Map<number, TaskCurve>();
	for (const task of tasks) {
		const E = mapEffort(task.difficulty);
		const beta = mapEnjoyability(task.enjoyment);
		const phi = calculateFlowStateTime(E, beta, constants);
		const curve: TaskCurve = {
			id: task.id,
			title: task.title,
			amp: E * beta + beta / E,
			k: 1 / phi,
			phi,
			wc: clamp01(task.cognitiveDemand),
			wp: clamp01(task.physicalDemand),
			refOutput: 0
		};
		const m = params.restRecoveryMultiplier;
		const b = params.microRecoveryFraction;
		curve.refOutput = blockOutput(
			curve,
			1,
			1,
			reservoirLaw(curve.wc, params.alphaCog, params.recoveryRate, m, b),
			reservoirLaw(curve.wp, params.alphaPhys, params.recoveryRate, m, b),
			OPTIMAL_PHI_MULTIPLIER * phi
		);
		curves.set(task.id, curve);
	}
	return curves;
}

/**
 * Satiety wrapper V(O) = κ·ln(1 + O/κ), κ = scale·refOutput: strictly
 * increasing and concave with V(0) = 0, V′(0) = 1 (early output is valued at
 * face value) and V′(κ) = ½. scale ≤ 0 disables. Concavity in the per-task
 * TOTAL is the whole mechanism: it lives outside the dynamics, so warm-up,
 * reservoirs, and the quadrature are untouched (MATH.md §8.4).
 */
function satietyValue(rawOutput: number, refOutput: number, scale: number): number {
	if (scale <= 0 || refOutput <= 0) return rawOutput;
	const kappa = scale * refOutput;
	return kappa * Math.log(1 + rawOutput / kappa);
}

function clamp01(x: number): number {
	return Math.min(1, Math.max(0, x));
}

// ================== Reservoir dynamics (closed form) ==================

/**
 * dC/dτ = −α·w·C + r'·g·(1−C) is linear with constant coefficients:
 * C(τ) = C_eq + (C₀ − C_eq)·e^(−ρτ), ρ = α·w + r'·g, C_eq = r'·g/ρ,
 * where r' = r·restMultiplier is the intermittent-task-corrected recovery rate
 * and g = 1−(1−b)·w is the recovery gate with micro-recovery fraction b. With
 * b = 0 the gate is the pure (1−w) and a full-demand task has C_eq = 0; with
 * b > 0 it drains toward the floor b·r'/(α + b·r') instead (MATH.md §8.5).
 */
interface ReservoirLaw {
	rho: number;
	eq: number;
}

function reservoirLaw(
	demand: number,
	alpha: number,
	recovery: number,
	restMultiplier = 1,
	microRecovery = 0
): ReservoirLaw {
	const rec = recovery * restMultiplier;
	const gate = 1 - (1 - microRecovery) * demand;
	const rho = alpha * demand + rec * gate;
	// ρ = 0 only when both terms vanish; the reservoir then holds its level and
	// eq is never used (reservoirAt short-circuits).
	return { rho, eq: rho > 0 ? (rec * gate) / rho : 0 };
}

function reservoirAt(c0: number, law: ReservoirLaw, t: number): number {
	if (law.rho <= 0 || t <= 0) return c0;
	return law.eq + (c0 - law.eq) * Math.exp(-law.rho * t);
}

/**
 * Session phase to resume a task at, given its last-seen memory and the current
 * clock time (Monk/Trafton): sEnd·e^(−gap/τ). No prior memory, or τ ≤ 0, means
 * a cold start at 0 (the old binary reset). Adjacent same-task blocks are merged
 * before this runs, so the gap here is always strictly positive.
 */
function resumePhase(
	last: { sEnd: number; tEnd: number } | undefined,
	now: number,
	tau: number
): number {
	if (!last || tau <= 0) return 0;
	return last.sEnd * Math.exp(-(now - last.tEnd) / tau);
}

// ================== Block output ==================

/**
 * ∫₀ᴰ p(sStart+u)·C_cog(u)^wc·C_phys(u)^wp du via composite Simpson. Warm-up is
 * indexed by session phase (sStart + block-local time u), so a resumed task
 * starts partway up its productivity curve; the reservoirs are indexed by u
 * because they carry their own level across blocks. The reservoir factors are
 * closed-form, so only the quadrature is numeric. The node count scales with
 * the fastest timescale in the integrand (ϕ or 1/ρ) so short-flow tasks inside
 * long blocks are still resolved.
 */
function blockOutput(
	curve: TaskCurve,
	cog0: number,
	phys0: number,
	lawC: ReservoirLaw,
	lawP: ReservoirLaw,
	hours: number,
	sStart = 0
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
		const u = j * h;
		const s = sStart + u;
		const p = curve.amp * curve.k * s * Math.exp(-curve.k * s);
		const gate =
			Math.pow(reservoirAt(cog0, lawC, u), curve.wc) *
			Math.pow(reservoirAt(phys0, lawP, u), curve.wp);
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
export function normalizeSchedule(blocks: ScheduleBlock[], windowHours: number): ScheduleBlock[] {
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
	const curves = buildCurves(tasks, constants, params);
	const blocks = normalizeSchedule(blocksIn, windowHours).filter(
		(b) => b.taskId === null || curves.has(b.taskId)
	);

	const m = params.restRecoveryMultiplier;
	const bMicro = params.microRecoveryFraction;
	const restLawC = reservoirLaw(0, params.alphaCog, params.recoveryRate, m, bMicro);
	const restLawP = reservoirLaw(0, params.alphaPhys, params.recoveryRate, m, bMicro);

	let cog = clamp01(params.initialCog);
	let phys = clamp01(params.initialPhys);
	let t = 0;
	let totalOutput = 0;
	let workHours = 0;
	const evaluated: EvaluatedBlock[] = [];
	// Per-task warm-up memory: session phase reached and the clock time it ended,
	// so a later block on the same task can resume with decayed carryover.
	const phase = new Map<number, { sEnd: number; tEnd: number }>();
	// Per-task raw daily output, the satiety accumulator. Unlike the session
	// phase it never decays — breaks must not launder satiety away.
	const outputByTask = new Map<number, number>();

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
			const lawC = reservoirLaw(curve.wc, params.alphaCog, params.recoveryRate, m, bMicro);
			const lawP = reservoirLaw(curve.wp, params.alphaPhys, params.recoveryRate, m, bMicro);
			const sStart = resumePhase(phase.get(b.taskId), t, params.resumptionTimeConstant);
			const output = blockOutput(curve, cog, phys, lawC, lawP, b.hours, sStart);
			phase.set(b.taskId, { sEnd: sStart + b.hours, tEnd: t + b.hours });
			outputByTask.set(b.taskId, (outputByTask.get(b.taskId) ?? 0) + output);
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

	let satiatedOutput = 0;
	for (const [taskId, raw] of outputByTask) {
		satiatedOutput += satietyValue(raw, curves.get(taskId)!.refOutput, params.satietyScale);
	}

	return {
		blocks: evaluated,
		totalOutput,
		satiatedOutput,
		workHours,
		leisureHours,
		freeTimeBonus,
		terminalBonus,
		objective: satiatedOutput + freeTimeBonus + terminalBonus,
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
	const curves = buildCurves(tasks, constants, params);
	const blocks = normalizeSchedule(blocksIn, windowHours).filter(
		(b) => b.taskId === null || curves.has(b.taskId)
	);
	const m = params.restRecoveryMultiplier;
	const bMicro = params.microRecoveryFraction;
	const restLawC = reservoirLaw(0, params.alphaCog, params.recoveryRate, m, bMicro);
	const restLawP = reservoirLaw(0, params.alphaPhys, params.recoveryRate, m, bMicro);

	const points: TrajectoryPoint[] = [];
	let cog = clamp01(params.initialCog);
	let phys = clamp01(params.initialPhys);
	let t = 0;
	const phase = new Map<number, { sEnd: number; tEnd: number }>();

	const sampleSegment = (
		hours: number,
		curve: TaskCurve | null,
		lawC: ReservoirLaw,
		lawP: ReservoirLaw,
		sStart = 0
	) => {
		const steps = Math.max(1, Math.ceil(hours / dtHours));
		for (let j = 0; j < steps; j++) {
			const u = (j * hours) / steps;
			const c = reservoirAt(cog, lawC, u);
			const p = reservoirAt(phys, lawP, u);
			const s = sStart + u;
			const rate = curve
				? curve.amp *
					curve.k *
					s *
					Math.exp(-curve.k * s) *
					Math.pow(c, curve.wc) *
					Math.pow(p, curve.wp)
				: 0;
			points.push({ t: t + u, cog: c, phys: p, rate, taskId: curve?.id ?? null });
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
			const sStart = resumePhase(phase.get(b.taskId), t, params.resumptionTimeConstant);
			phase.set(b.taskId, { sEnd: sStart + b.hours, tEnd: t + b.hours });
			sampleSegment(
				b.hours,
				curve,
				reservoirLaw(curve.wc, params.alphaCog, params.recoveryRate, m, bMicro),
				reservoirLaw(curve.wp, params.alphaPhys, params.recoveryRate, m, bMicro),
				sStart
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
 * reassign its task (or turn it into rest), reassign the second half of a
 * block, transfer a step between two blocks, swap adjacent blocks, insert a
 * new task/rest block at any boundary (step-sized or a full T* session), and
 * split a block around a rest break. The compound moves (transfer,
 * half-reassign, T*-insert) exist because single-step paths to those states
 * pass through downhill intermediates — without them the search provably
 * strands ~1% of objective and can drop a fundable task (probe 2026-07-14).
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

	// T* per task, for the full-session insert move.
	const sessionHours = new Map<number, number>();
	for (const task of tasks) {
		const phi = calculateFlowStateTime(
			mapEffort(task.difficulty),
			mapEnjoyability(task.enjoyment),
			constants
		);
		sessionHours.set(task.id, OPTIMAL_PHI_MULTIPLIER * phi);
	}

	let best: ScheduleBlock[] = [];
	let bestEval = emptyEval;
	for (const seed of buildSeeds(tasks, windowHours, constants)) {
		const result = localSearch(
			seed,
			tasks,
			windowHours,
			params,
			constants,
			step,
			maxIterations,
			sessionHours
		);
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

	// Classic-flavored seed — each task once at its single-task optimum, best
	// tasks first, until the window is spent.
	const classicOver = (list: EnergyTaskInput[]): ScheduleBlock[] => {
		const seed: ScheduleBlock[] = [];
		let left = windowHours;
		for (const task of list) {
			if (left <= 0) break;
			const hours = Math.min(OPTIMAL_PHI_MULTIPLIER * phiOf(task), left);
			seed.push({ taskId: task.id, hours });
			left -= hours;
		}
		return seed;
	};

	// Seed 2: all-in on the single best task.
	const allIn: ScheduleBlock[] = [{ taskId: byValue[0].id, hours: windowHours }];

	// Seed 3: round-robin hour blocks (a deliberately fragmented start so the
	// search also explores from the interleaved side).
	const roundRobin: ScheduleBlock[] = [];
	let left = windowHours;
	for (let i = 0; left > 1e-9 && i < 24; i++) {
		const task = byValue[i % byValue.length];
		const hours = Math.min(1, left);
		roundRobin.push({ taskId: task.id, hours });
		left -= hours;
	}

	// Seed 4: empty (all leisure) — lets the search justify every worked hour.
	// Seeds 5+: classic with one task dropped. "Fund everything but X" optima
	// are unreachable by uphill moves from the full-classic basin (dropping a
	// funded task is downhill until its hours are redistributed), so each needs
	// its own starting point (probe 2026-07-14).
	const seeds: ScheduleBlock[][] = [classicOver(byValue), allIn, roundRobin, []];
	if (byValue.length >= 2) {
		for (const dropped of byValue) {
			seeds.push(classicOver(byValue.filter((task) => task.id !== dropped.id)));
		}
	}
	return seeds;
}

function localSearch(
	seed: ScheduleBlock[],
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams,
	constants: UserConstants,
	step: number,
	maxIterations: number,
	sessionHours: Map<number, number>
): OptimizeResult {
	let current = normalizeSchedule(seed, windowHours);
	let currentEval = evaluateSchedule(current, tasks, windowHours, params, constants);

	for (let iter = 0; iter < maxIterations; iter++) {
		let improved: { blocks: ScheduleBlock[]; evaluation: ScheduleEvaluation } | null = null;
		for (const candidate of neighbors(current, tasks, windowHours, step, sessionHours)) {
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
	step: number,
	sessionHours: Map<number, number>
): Generator<ScheduleBlock[]> {
	const total = blocks.reduce((sum, b) => sum + b.hours, 0);
	const avail = windowHours - total;
	const room = avail > step - 1e-9;

	for (let i = 0; i < blocks.length; i++) {
		// Grow by a step, or by the sub-step remainder of the window — the
		// T*-session insert puts totals off the step lattice, and a tail sliver
		// must stay fillable (with worthless leisure, idle time is pure loss).
		const growBy = room ? step : avail;
		if (growBy > 1e-9)
			yield replaceAt(blocks, i, { ...blocks[i], hours: blocks[i].hours + growBy });
		yield replaceAt(blocks, i, { ...blocks[i], hours: blocks[i].hours - step });
		yield [...blocks.slice(0, i), ...blocks.slice(i + 1)];
		if (i + 1 < blocks.length) {
			const swapped = [...blocks];
			[swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
			yield swapped;
		}
		for (const task of tasks) {
			if (task.id !== blocks[i].taskId)
				yield replaceAt(blocks, i, { ...blocks[i], taskId: task.id });
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
		// Hand the second half of a block to another task: swaps time in at a
		// useful session length, where the one-step path (shrink, then insert)
		// dies at a sub-warm-up sliver.
		if (blocks[i].taskId !== null && blocks[i].hours >= 2 * step) {
			const half = blocks[i].hours / 2;
			for (const task of tasks) {
				if (task.id === blocks[i].taskId) continue;
				yield [
					...blocks.slice(0, i),
					{ taskId: blocks[i].taskId, hours: half },
					{ taskId: task.id, hours: half },
					...blocks.slice(i + 1)
				];
			}
		}
		// Transfer a step from block i to block j: reallocation in one move,
		// for plateaus where the shrink and the grow are each downhill alone.
		for (let j = 0; j < blocks.length; j++) {
			if (j === i) continue;
			const shrunk = replaceAt(blocks, i, { ...blocks[i], hours: blocks[i].hours - step });
			yield replaceAt(shrunk, j, { ...shrunk[j], hours: shrunk[j].hours + step });
		}
	}

	for (let pos = 0; pos <= blocks.length; pos++) {
		if (!room) break;
		for (const task of tasks) {
			yield [...blocks.slice(0, pos), { taskId: task.id, hours: step }, ...blocks.slice(pos)];
			// Full-T*-session insert: a step-sized sliver of a cold task rarely
			// pays (warm-up), but a whole session might.
			const session = Math.min(sessionHours.get(task.id) ?? step, avail);
			if (session > step + 1e-9) {
				yield [...blocks.slice(0, pos), { taskId: task.id, hours: session }, ...blocks.slice(pos)];
			}
		}
		yield [...blocks.slice(0, pos), { taskId: null, hours: step }, ...blocks.slice(pos)];
	}
}

function replaceAt(blocks: ScheduleBlock[], index: number, block: ScheduleBlock): ScheduleBlock[] {
	const next = [...blocks];
	next[index] = block;
	return next;
}

// ================== Drain-rate calibration (α fit) ==================

/**
 * One end-of-session drain rating, reduced to what the fit needs for ONE
 * reservoir: after `hours` on a task demanding `demand` of this reservoir,
 * the user rated it `drainedFraction` empty (rating/10 — 0 = fresh, 1 = spent).
 */
export interface DrainObservation {
	/** Demand w on this reservoir (0–1) during the rated session */
	demand: number;
	/** Session length in hours */
	hours: number;
	/** Reported drain, mapped to [0,1] (a 0–10 rating divided by 10) */
	drainedFraction: number;
}

export interface DrainRateFit {
	/** MAP drain rate α for this reservoir (the fallback when not fitted) */
	alpha: number;
	fitted: boolean;
	/** Approximate posterior std of α (Gauss–Newton/Laplace); only when fitted */
	alphaStd?: number;
	/** Informative observations used (demand > 0 and hours > 0) */
	usedCount: number;
}

/**
 * Prior strength for the drain-rate fit — the λ in the ridge penalty
 * λ·(α − α₀)². Bayesian reading (same construction as RIDGE_PRIOR_STRENGTH):
 * with rating noise σ_d and prior α ~ N(α₀, σ_d²/λ), the MAP of
 *
 *   Σᵢ (dᵢ − D(wᵢ, Hᵢ; α))² + λ·(α − α₀)²
 *
 * is exactly this penalized fit. Unlike the ϕ fit, the "design" here is the
 * SENSITIVITY dD/dα (≈ 0.3–0.9 per unit α for typical 1–3h full-demand
 * sessions, vanishing as w → 0), so λ is calibrated in those units, by probe
 * (λ sweep, 2026-07-15): one consistent full-demand log moves α ~50% of the
 * way to what it implies, three ~70%, ten ~85%; a clean 8-log set recovers a
 * true α of 1.2 as 0.96 (the shortfall is drain saturation — the data barely
 * distinguishes large αs — not the prior). Stronger λ=0.5 left 3 logs at only
 * 57% while buying almost no extra outlier resistance (that comes from the
 * other logs, not the prior).
 */
export const DRAIN_PRIOR_STRENGTH = 0.25;

/**
 * Prior scale for drain-rating noise: 1.5 notches on the 0–10 scale (0.15 of
 * the drained fraction), blended with the residuals as ν₀ pseudo-observations
 * exactly like FLOW_NOISE_PRIOR_STD — "how drained do you feel" is far fuzzier
 * than a stopwatch, so the floor is wider than the ϕ fit's 0.25h.
 */
export const DRAIN_NOISE_PRIOR_STD = 0.15;

/**
 * Fit bounds = the Energy Lab's α input range, so a fitted value is always
 * representable (and appliable) in the UI. The bounds also play the role of
 * fitUserConstants' absurdity guard: wildly inconsistent ratings can at worst
 * pin α to an extreme-but-valid drain rate, never break the dynamics.
 */
export const ALPHA_FIT_MIN = 0.05;
export const ALPHA_FIT_MAX = 2;

/**
 * Calibrate ONE reservoir's drain rate α from end-of-session drain ratings.
 *
 * MODEL: the session is assumed to start from a full reservoir (a
 * standardized yardstick, like refOutput — MATH.md §8.7 discusses the
 * approximation), so the reservoir law predicts a drained fraction
 *
 *   D(w, H; α) = 1 − C(H),  C(H) = C_eq + (1 − C_eq)·e^(−ρH)
 *
 * with ρ, C_eq from the §8.1/§8.5 law at the CURRENT recovery parameters —
 * the fit conditions on them, which is what makes α identifiable at all
 * (recoveryRate itself cannot be recovered from end-of-session ratings; it
 * would need pre/post-REST rating pairs). A 0–10 rating maps linearly to
 * D ∈ [0, 1]: 0 = fresh, 10 = completely drained.
 *
 * FIT: 1-D ridge toward the default (the fitUserConstants pattern):
 * minimize Σ(dᵢ − Dᵢ(α))² + λ(α − α₀)² over [ALPHA_FIT_MIN, ALPHA_FIT_MAX]
 * by deterministic coarse grid + golden-section refinement (D is smooth and
 * monotone in α but the objective has no closed-form minimizer). Observations
 * with demand = 0 or hours = 0 are dropped: D is then constant in α — the
 * rating says nothing about THIS reservoir's drain rate (whatever tired it
 * was not this session's doing), and keeping it would only pollute σ̂².
 *
 * Returns the fallback with fitted: false when nothing informative remains.
 */
export function fitDrainRate(
	observations: DrainObservation[],
	fallbackAlpha: number,
	params: Pick<EnergyParams, 'recoveryRate' | 'restRecoveryMultiplier' | 'microRecoveryFraction'>
): DrainRateFit {
	const used = observations.filter((o) => o.demand > 0 && o.hours > 0);
	if (used.length === 0) {
		return { alpha: fallbackAlpha, fitted: false, usedCount: 0 };
	}

	const alpha0 = Math.min(Math.max(fallbackAlpha, ALPHA_FIT_MIN), ALPHA_FIT_MAX);
	const predicted = (alpha: number, o: DrainObservation): number => {
		const law = reservoirLaw(
			clamp01(o.demand),
			alpha,
			params.recoveryRate,
			params.restRecoveryMultiplier,
			params.microRecoveryFraction
		);
		return 1 - reservoirAt(1, law, o.hours);
	};
	const ssr = (alpha: number): number => {
		let sum = 0;
		for (const o of used) {
			const resid = clamp01(o.drainedFraction) - predicted(alpha, o);
			sum += resid * resid;
		}
		return sum;
	};
	const objective = (alpha: number): number =>
		ssr(alpha) + DRAIN_PRIOR_STRENGTH * (alpha - alpha0) * (alpha - alpha0);

	// Coarse grid to bracket the global minimum (the objective is smooth but
	// not provably unimodal for adversarial data), then golden-section refine.
	const GRID = 128;
	let bestIdx = 0;
	let bestVal = Infinity;
	for (let i = 0; i <= GRID; i++) {
		const alpha = ALPHA_FIT_MIN + ((ALPHA_FIT_MAX - ALPHA_FIT_MIN) * i) / GRID;
		const val = objective(alpha);
		if (val < bestVal) {
			bestVal = val;
			bestIdx = i;
		}
	}
	const cell = (ALPHA_FIT_MAX - ALPHA_FIT_MIN) / GRID;
	let lo = Math.max(ALPHA_FIT_MIN, ALPHA_FIT_MIN + (bestIdx - 1) * cell);
	let hi = Math.min(ALPHA_FIT_MAX, ALPHA_FIT_MIN + (bestIdx + 1) * cell);
	const INV_PHI = (Math.sqrt(5) - 1) / 2;
	let x1 = hi - INV_PHI * (hi - lo);
	let x2 = lo + INV_PHI * (hi - lo);
	let f1 = objective(x1);
	let f2 = objective(x2);
	for (let i = 0; i < 48; i++) {
		if (f1 < f2) {
			hi = x2;
			x2 = x1;
			f2 = f1;
			x1 = hi - INV_PHI * (hi - lo);
			f1 = objective(x1);
		} else {
			lo = x1;
			x1 = x2;
			f1 = f2;
			x2 = lo + INV_PHI * (hi - lo);
			f2 = objective(x2);
		}
	}
	const alpha = (lo + hi) / 2;

	// Noise estimate (inverse-gamma-style blend, as in fitUserConstants) and
	// Laplace posterior std via the Gauss–Newton curvature Σ(dD/dα)² + λ.
	const nu0 = DRAIN_PRIOR_STRENGTH;
	const sigma2 =
		(nu0 * DRAIN_NOISE_PRIOR_STD * DRAIN_NOISE_PRIOR_STD + ssr(alpha)) / (nu0 + used.length);
	const h = 1e-4;
	let sensitivity = 0;
	for (const o of used) {
		const dD = (predicted(alpha + h, o) - predicted(alpha - h, o)) / (2 * h);
		sensitivity += dD * dD;
	}
	const alphaStd = Math.sqrt(sigma2 / (sensitivity + DRAIN_PRIOR_STRENGTH));

	return { alpha, fitted: true, alphaStd, usedCount: used.length };
}
