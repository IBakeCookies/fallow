/**
 * Zenith Energy Model (powers the /energy route)
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
 *   costly, just no longer catastrophic the way a hard reset made it. MATH.md §8.2.
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
	type UserConstants,
} from '$lib/business/model/zenith';

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
	 * MATH.md §8.1.
	 */
	restRecoveryMultiplier: number;
	/**
	 * Micro-recovery fraction b: the share of recovery capacity that stays
	 * active even while working at full demand (micro-pauses between efforts —
	 * the same intermittent-effort regime as restRecoveryMultiplier). The
	 * recovery gate becomes 1−(1−b)·w instead of 1−w, so a w = 1 task drains
	 * toward the floor b·r′/(α + b·r′) > 0 instead of exactly 0. Without it a
	 * full-demand task has no basal floor at all. (The "demand 10 vs 9.5 flips
	 * the plan" cliff measured in 2026-07-14 does NOT reproduce under today's
	 * search and lattice.) 0 disables, recovering the pure (1−w) gate.
	 * MATH.md §8.5.
	 */
	microRecoveryFraction: number;
	/**
	 * Warm-up / task-state retention time constant, hours (Monk, Trafton &
	 * Boehm-Davis 2008 memory-for-goals). Resuming a task after being away for a
	 * gap g keeps a fraction e^(−g/resumptionTimeConstant) of the session phase
	 * built up before — so a brief switch costs little warm-up while a long gap
	 * approaches a cold restart. ≤0 reproduces the old binary reset.
	 * MATH.md §8.2.
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
	initialPhys: 1,
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
	/** Both reservoirs at the end of the WINDOW, after the trailing implicit rest —
	 *  what `terminalBonus` is priced on. */
	endCog: number;
	endPhys: number;
	/**
	 * Both reservoirs at the end of the last WORKED block — how spent the plan
	 * leaves you before the evening recovers you. The honest answer to "how
	 * depleted does this day end", and the reading Burnout Risk takes;
	 * `endCog/endPhys` answer a different question and read near-saturated.
	 * Equal to the initial levels when nothing is worked.
	 */
	workEndCog: number;
	workEndPhys: number;
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
	/** This task's reservoir laws under the params the curves were built with. */
	lawC: ReservoirLaw;
	lawP: ReservoirLaw;
}

/**
 * Pure in (tasks, constants, params). Built once per search or fit and
 * threaded through every evaluation (`evaluateWithCurves`) — the refOutput
 * quadrature per task made per-evaluation rebuilds the dominant optimizer
 * cost (hoisting measured 2.6× on a 4-task/8h optimizeSchedule, 104 → 40 ms).
 */
function buildCurves(
	tasks: EnergyTaskInput[],
	constants: UserConstants,
	params: EnergyParams,
): Map<number, TaskCurve> {
	const curves = new Map<number, TaskCurve>();
	const m = params.restRecoveryMultiplier;
	const b = params.microRecoveryFraction;

	for (const task of tasks) {
		const E = mapEffort(task.difficulty);
		const beta = mapEnjoyability(task.enjoyment);
		const phi = calculateFlowStateTime(E, beta, constants);
		const wc = clamp01(task.cognitiveDemand);
		const wp = clamp01(task.physicalDemand);

		const curve: TaskCurve = {
			id: task.id,
			title: task.title,
			amp: E * beta + beta / E,
			k: 1 / phi,
			phi,
			wc,
			wp,
			refOutput: 0,
			lawC: reservoirLaw(wc, params.alphaCog, params.recoveryRate, m, b),
			lawP: reservoirLaw(wp, params.alphaPhys, params.recoveryRate, m, b),
		};

		curve.refOutput = blockOutput(
			curve,
			1,
			1,
			curve.lawC,
			curve.lawP,
			OPTIMAL_PHI_MULTIPLIER * phi,
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
	microRecovery = 0,
): ReservoirLaw {
	const rec = recovery * restMultiplier;
	const gate = 1 - (1 - microRecovery) * demand;
	const rho = alpha * demand + rec * gate;

	// On the valid domain (α, r, b ≥ 0 — sanitizeEnergyParams clamps persisted
	// params there) ρ = 0 only when both terms vanish; the reservoir then holds
	// its level and eq is never used (reservoirAt short-circuits).
	return {
		rho,
		eq: rho > 0 ? (rec * gate) / rho : 0,
	};
}

function reservoirAt(c0: number, law: ReservoirLaw, t: number): number {
	if (law.rho <= 0 || t <= 0) return c0;

	return law.eq + (c0 - law.eq) * Math.exp(-law.rho * t);
}

/** What a task contributes to reservoir drain — the warm-up/output fields are irrelevant. */
export type ReservoirDemand = Pick<EnergyTaskInput, 'id' | 'cognitiveDemand' | 'physicalDemand'>;

/**
 * Evolve both reservoirs over a block schedule and return the end levels.
 * Drain-law only — no warm-up curves, no output quadrature — so it needs
 * neither UserConstants nor the tasks' difficulty/enjoyment. This is the
 * energy-model core behind the main page's Burnout Risk metric, which has no
 * use for the output side of evaluateSchedule.
 */
export function simulateReservoirs(
	blocks: ScheduleBlock[],
	tasks: ReservoirDemand[],
	params: EnergyParams,
): { endCog: number; endPhys: number } {
	const byId = new Map(tasks.map((t) => [t.id, t]));
	let cog = clamp01(params.initialCog);
	let phys = clamp01(params.initialPhys);

	for (const b of blocks) {
		if (b.hours <= 0) continue;

		const task = b.taskId === null ? undefined : byId.get(b.taskId);

		const lawFor = (demand: number, alpha: number) =>
			reservoirLaw(
				clamp01(demand),
				alpha,
				params.recoveryRate,
				params.restRecoveryMultiplier,
				params.microRecoveryFraction,
			);

		cog = reservoirAt(cog, lawFor(task?.cognitiveDemand ?? 0, params.alphaCog), b.hours);
		phys = reservoirAt(phys, lawFor(task?.physicalDemand ?? 0, params.alphaPhys), b.hours);
	}

	return {
		endCog: cog,
		endPhys: phys,
	};
}

/**
 * Session phase to resume a task at, given its last-seen memory and the current
 * clock time (Monk/Trafton): sEnd·e^(−gap/τ). No prior memory, or τ ≤ 0, means
 * a cold start at 0 (the old binary reset). Adjacent same-task blocks are merged
 * before this runs, so the gap here is always strictly positive. MATH.md §8.2.
 */
function resumePhase(
	last: { sEnd: number; tEnd: number } | undefined,
	now: number,
	tau: number,
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
	sStart = 0,
): number {
	if (hours <= 0) return 0;

	const fastest = Math.min(
		curve.phi,
		lawC.rho > 0 ? 1 / lawC.rho : Infinity,
		lawP.rho > 0 ? 1 / lawP.rho : Infinity,
		hours,
	);

	// Simpson error ~ h⁴: 16 nodes per fastest timescale, capped at 1024. At the
	// 0.1h ϕ floor the cap binds above a 6.4h block and the density then falls —
	// relative error grows from ~3e-7 to 3.5e-6 at 12h and 5.6e-5 at 24h
	// (scripts/enb-simpson-error.probe.ts). Never binds at default constants.
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
		else
			out.push({
				taskId: b.taskId,
				hours,
			});

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
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
): ScheduleEvaluation {
	return evaluateWithCurves(blocksIn, buildCurves(tasks, constants, params), windowHours, params);
}

/**
 * The hot path: `evaluateSchedule` with prebuilt curves, so a caller that
 * evaluates many candidates under the same (tasks, constants, params) — the
 * optimizer, the stopping fit — pays for `buildCurves` once.
 */
function evaluateWithCurves(
	blocksIn: ScheduleBlock[],
	curves: Map<number, TaskCurve>,
	windowHours: number,
	params: EnergyParams,
): ScheduleEvaluation {
	const blocks = normalizeSchedule(blocksIn, windowHours).filter(
		(b) => b.taskId === null || curves.has(b.taskId),
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
	// The levels as of the last worked block — every work block overwrites them,
	// so rest after the final one (explicit or the tail) cannot launder them.
	let workEndCog = cog;
	let workEndPhys = phys;
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
				physAfter: phys,
			});
		} else {
			const curve = curves.get(b.taskId)!;
			const sStart = resumePhase(phase.get(b.taskId), t, params.resumptionTimeConstant);
			const output = blockOutput(curve, cog, phys, curve.lawC, curve.lawP, b.hours, sStart);

			phase.set(b.taskId, {
				sEnd: sStart + b.hours,
				tEnd: t + b.hours,
			});

			outputByTask.set(b.taskId, (outputByTask.get(b.taskId) ?? 0) + output);
			totalOutput += output;
			workHours += b.hours;
			cog = reservoirAt(cog, curve.lawC, b.hours);
			phys = reservoirAt(phys, curve.lawP, b.hours);
			workEndCog = cog;
			workEndPhys = phys;

			evaluated.push({
				taskId: b.taskId,
				title: curve.title,
				start: t,
				hours: b.hours,
				output,
				cogAfter: cog,
				physAfter: phys,
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
		endPhys: phys,
		workEndCog,
		workEndPhys,
	};
}

// ================== Trajectory sampling (for charts) ==================

export function sampleTrajectory(
	blocksIn: ScheduleBlock[],
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams = DEFAULT_ENERGY_PARAMS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	dtHours: number = 0.05,
): TrajectoryPoint[] {
	const curves = buildCurves(tasks, constants, params);

	const blocks = normalizeSchedule(blocksIn, windowHours).filter(
		(b) => b.taskId === null || curves.has(b.taskId),
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
		sStart = 0,
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

			points.push({
				t: t + u,
				cog: c,
				phys: p,
				rate,
				taskId: curve?.id ?? null,
			});
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

			phase.set(b.taskId, {
				sEnd: sStart + b.hours,
				tEnd: t + b.hours,
			});

			sampleSegment(b.hours, curve, curve.lawC, curve.lawP, sStart);
		}
	}

	if (windowHours - t > 0) sampleSegment(windowHours - t, null, restLawC, restLawP);

	points.push({
		t: windowHours,
		cog,
		phys,
		rate: 0,
		taskId: null,
	});

	return points;
}

// ================== Optimizer: multi-seed local search ==================

/**
 * Planning granularity of the optimizer: every block in a returned plan is a
 * whole number of 45-minute units. The model's precision (± minutes) far
 * exceeds what 0–10 sliders justify, and sub-quarter-hour blocks aren't
 * schedulable by a human anyway (MATH.md §8.8).
 */
export const DEFAULT_STEP_HOURS = 0.75;

/**
 * How many of the highest-amplitude tasks the pair seeds below are drawn from:
 * C(4,2) = 6 seeds, not C(n,2), because each pair seed starts fragmented and
 * climbs long. Was 3 until ROADMAP M54 measured what the third task left on the
 * table — on 6 of 7 days in 2000 a cap of 4 changes the funded SET, not the
 * hours. What every cap costs and saves is measured in
 * `scripts/energy-search-gap.probe.ts`.
 */
const PAIR_SEED_TASKS = 4;

export interface OptimizeOptions {
	/**
	 * Duration granularity of the plan (hours): every block is a multiple of
	 * this, and any sub-step remainder of the window is left as free time.
	 * Default DEFAULT_STEP_HOURS (45 min).
	 */
	stepHours?: number;
	/** Safety cap on hill-climb iterations per seed. Default 300. */
	maxIterations?: number;
	/**
	 * How many top-amplitude tasks the pair seeds are drawn from. Default
	 * `PAIR_SEED_TASKS`; 0 removes the family. An instrument knob — no product
	 * caller sets it, and it exists so the cap can be priced against its
	 * neighbours (`scripts/energy-search-gap.probe.ts`).
	 */
	pairSeedTasks?: number;
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
 * split a block around a rest break at any interior step. The compound moves
 * (transfer, half-reassign, T*-insert) exist because single-step paths to those
 * states pass through downhill intermediates — without them the search provably
 * strands ~1% of objective and can drop a fundable task (probe 2026-07-14).
 *
 * Every candidate the search visits stays on the step lattice: seeds, T*
 * sessions and every block cut are snapped to the step, and moves only add or
 * remove whole steps, so the invariant holds inductively (MATH.md §8.8).
 */
export function optimizeSchedule(
	tasks: EnergyTaskInput[],
	windowHours: number,
	params: EnergyParams = DEFAULT_ENERGY_PARAMS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	options: OptimizeOptions = {},
): OptimizeResult {
	const step = options.stepHours ?? DEFAULT_STEP_HOURS;
	const maxIterations = options.maxIterations ?? 300;
	const pairSeedTasks = options.pairSeedTasks ?? PAIR_SEED_TASKS;
	// One curve build for the whole search — every candidate evaluation reuses it.
	const curves = buildCurves(tasks, constants, params);
	const emptyEval = evaluateWithCurves([], curves, windowHours, params);

	if (windowHours <= 0 || tasks.length === 0) {
		return {
			blocks: [],
			evaluation: emptyEval,
		};
	}

	// T* per task, snapped to the lattice, for the full-session insert move.
	const sessionHours = new Map<number, number>();

	for (const curve of curves.values()) {
		sessionHours.set(curve.id, snapToStep(OPTIMAL_PHI_MULTIPLIER * curve.phi, step));
	}

	let best: ScheduleBlock[] = [];
	let bestEval = emptyEval;

	for (const seed of buildSeeds(tasks, windowHours, constants, step, pairSeedTasks)) {
		const result = localSearch(
			seed.blocks,
			seed.tasks,
			curves,
			windowHours,
			params,
			step,
			maxIterations,
			sessionHours,
		);

		if (result.evaluation.objective > bestEval.objective + 1e-9) {
			best = result.blocks;
			bestEval = result.evaluation;
		}
	}

	return {
		blocks: best,
		evaluation: bestEval,
	};
}

/** Nearest multiple of the step, floored at one step (a zero block is no block). */
function snapToStep(hours: number, step: number): number {
	return Math.max(step, Math.round(hours / step) * step);
}

/** Largest multiple of the step that fits in `hours` (0 if none does). */
function floorToStep(hours: number, step: number): number {
	return Math.floor(hours / step + 1e-9) * step;
}

/** Peak + start amplitude a + p₀ = E·β + β/E — the seed/canonical task ordering. */
function taskAmplitude(task: EnergyTaskInput): number {
	const E = mapEffort(task.difficulty);
	const beta = mapEnjoyability(task.enjoyment);

	return E * beta + beta / E;
}

/** A starting plan plus the tasks its local search may reach for. */
interface Seed {
	blocks: ScheduleBlock[];
	tasks: EnergyTaskInput[];
}

function buildSeeds(
	tasks: EnergyTaskInput[],
	windowHours: number,
	constants: UserConstants,
	step: number,
	pairSeedTasks: number,
): Seed[] {
	const phiOf = (task: EnergyTaskInput) =>
		calculateFlowStateTime(mapEffort(task.difficulty), mapEnjoyability(task.enjoyment), constants);

	const byValue = [...tasks].sort((x, y) => taskAmplitude(y) - taskAmplitude(x));
	// Seeds start on the lattice and moves only add/remove whole steps, so the
	// search never leaves it; the sub-step window tail stays free time.
	const usable = floorToStep(windowHours, step);

	// Classic-flavored seed — each task once at its single-task optimum, best
	// tasks first, until the window is spent.
	const classicOver = (list: EnergyTaskInput[]): ScheduleBlock[] => {
		const seed: ScheduleBlock[] = [];
		let left = usable;

		for (const task of list) {
			if (left < step - 1e-9) break;

			const hours = Math.min(snapToStep(OPTIMAL_PHI_MULTIPLIER * phiOf(task), step), left);

			seed.push({
				taskId: task.id,
				hours,
			});

			left -= hours;
		}

		return seed;
	};

	// Seed 2: all-in on the single best task.
	const allIn: ScheduleBlock[] = [
		{
			taskId: byValue[0].id,
			hours: usable,
		},
	];

	// Seed 3: round-robin step blocks (a deliberately fragmented start so the
	// search also explores from the interleaved side).
	const roundRobinOver = (list: EnergyTaskInput[]): ScheduleBlock[] => {
		const seed: ScheduleBlock[] = [];
		let left = usable;

		for (let i = 0; left > step - 1e-9; i++) {
			seed.push({
				taskId: list[i % list.length].id,
				hours: step,
			});

			left -= step;
		}

		return seed;
	};

	// Seed 4: empty (all leisure) — lets the search justify every worked hour.
	// Seeds 5+: classic with one task dropped. "Fund everything but X" optima
	// are unreachable by uphill moves from the full-classic basin (dropping a
	// funded task is downhill until its hours are redistributed), so each needs
	// its own starting point (probe 2026-07-14).
	const seeds: Seed[] = [classicOver(byValue), allIn, roundRobinOver(byValue), []].map(
		(blocks) => ({
			blocks,
			tasks,
		}),
	);

	if (byValue.length >= 2) {
		for (const dropped of byValue) {
			seeds.push({
				blocks: classicOver(byValue.filter((task) => task.id !== dropped.id)),
				tasks,
			});
		}
	}

	// Seeds after those: each PAIR among the top tasks, round-robin over the two
	// and searched WITHIN the pair. Two enumerated days have an optimum funding
	// two tasks that no seed above reaches (probe 2026-08-13, MATH.md §8.6), and
	// neither a wider task pool nor a classic pair seed gets there: with the
	// dropped tasks still on offer the steepest first move re-funds one and the
	// climb leaves the pair's basin, while a classic pair seed's own basin misses
	// the interleaved optimum on one witness. The top-2 pair alone is not enough
	// — on neither witness is the winning pair the amplitude-prefix pair. Below
	// three tasks the only pair is the whole list, which seed 3 already is.
	const paired = byValue.length >= 3 ? Math.min(byValue.length, pairSeedTasks) : 0;

	for (let first = 0; first < paired; first++) {
		for (let second = first + 1; second < paired; second++) {
			const pair = [byValue[first], byValue[second]];

			seeds.push({
				blocks: roundRobinOver(pair),
				tasks: pair,
			});
		}
	}

	return seeds;
}

function localSearch(
	seed: ScheduleBlock[],
	tasks: EnergyTaskInput[],
	curves: Map<number, TaskCurve>,
	windowHours: number,
	params: EnergyParams,
	step: number,
	maxIterations: number,
	sessionHours: Map<number, number>,
): OptimizeResult {
	let current = normalizeSchedule(seed, windowHours);
	let currentEval = evaluateWithCurves(current, curves, windowHours, params);

	for (let iter = 0; iter < maxIterations; iter++) {
		let improved: { blocks: ScheduleBlock[]; evaluation: ScheduleEvaluation } | null = null;

		for (const candidate of neighbors(current, tasks, windowHours, step, sessionHours)) {
			const evaluation = evaluateWithCurves(candidate, curves, windowHours, params);

			if (evaluation.objective > (improved?.evaluation.objective ?? currentEval.objective) + 1e-9) {
				improved = {
					blocks: candidate,
					evaluation,
				};
			}
		}

		if (!improved) break;

		current = normalizeSchedule(improved.blocks, windowHours);
		currentEval = improved.evaluation;
	}

	return {
		blocks: current,
		evaluation: currentEval,
	};
}

function* neighbors(
	blocks: ScheduleBlock[],
	tasks: EnergyTaskInput[],
	windowHours: number,
	step: number,
	sessionHours: Map<number, number>,
): Generator<ScheduleBlock[]> {
	const total = blocks.reduce((sum, b) => sum + b.hours, 0);
	// Whole steps of remaining room — the sub-step window tail is not
	// schedulable at this granularity and stays free time by design.
	const avail = floorToStep(windowHours - total, step);
	const room = avail > step - 1e-9;

	for (let i = 0; i < blocks.length; i++) {
		if (room)
			yield replaceAt(blocks, i, {
				...blocks[i],
				hours: blocks[i].hours + step,
			});

		yield replaceAt(blocks, i, {
			...blocks[i],
			hours: blocks[i].hours - step,
		});

		yield [...blocks.slice(0, i), ...blocks.slice(i + 1)];

		if (i + 1 < blocks.length) {
			const swapped = [...blocks];
			[swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
			yield swapped;
		}

		for (const task of tasks) {
			if (task.id !== blocks[i].taskId)
				yield replaceAt(blocks, i, {
					...blocks[i],
					taskId: task.id,
				});
		}

		if (blocks[i].taskId !== null)
			yield replaceAt(blocks, i, {
				...blocks[i],
				taskId: null,
			});

		// Lattice-safe halves: for an odd number of steps the "half" is the
		// larger share, so both parts stay whole steps ≥ one step.
		const firstHalf = snapToStep(blocks[i].hours / 2, step);
		const secondHalf = blocks[i].hours - firstHalf;

		// Split around a rest break at every interior lattice point, worked hours
		// unchanged: tests whether a mid-session recovery pays for the warm-up it
		// destroys, and where it pays is not the midpoint (MATH.md §8.6).
		if (blocks[i].taskId !== null && blocks[i].hours >= 2 * step && room) {
			const steps = Math.round(blocks[i].hours / step);

			for (let worked = 1; worked < steps; worked++) {
				yield [
					...blocks.slice(0, i),
					{
						taskId: blocks[i].taskId,
						hours: worked * step,
					},
					{
						taskId: null,
						hours: step,
					},
					{
						taskId: blocks[i].taskId,
						hours: blocks[i].hours - worked * step,
					},
					...blocks.slice(i + 1),
				];
			}
		}

		// Hand the second half of a block to another task: swaps time in at a
		// useful session length, where the one-step path (shrink, then insert)
		// dies at a sub-warm-up sliver.
		if (blocks[i].taskId !== null && blocks[i].hours >= 2 * step) {
			for (const task of tasks) {
				if (task.id === blocks[i].taskId) continue;

				yield [
					...blocks.slice(0, i),
					{
						taskId: blocks[i].taskId,
						hours: firstHalf,
					},
					{
						taskId: task.id,
						hours: secondHalf,
					},
					...blocks.slice(i + 1),
				];
			}
		}

		// Transfer a step from block i to block j: reallocation in one move,
		// for plateaus where the shrink and the grow are each downhill alone.
		for (let j = 0; j < blocks.length; j++) {
			if (j === i) continue;

			const shrunk = replaceAt(blocks, i, {
				...blocks[i],
				hours: blocks[i].hours - step,
			});

			yield replaceAt(shrunk, j, {
				...shrunk[j],
				hours: shrunk[j].hours + step,
			});
		}
	}

	for (let pos = 0; pos <= blocks.length; pos++) {
		if (!room) break;

		for (const task of tasks) {
			yield [
				...blocks.slice(0, pos),
				{
					taskId: task.id,
					hours: step,
				},
				...blocks.slice(pos),
			];

			// Full-T*-session insert: a step-sized sliver of a cold task rarely
			// pays (warm-up), but a whole session might. Both terms are lattice
			// multiples (sessionHours is snapped, avail is floored).
			const session = Math.min(sessionHours.get(task.id) ?? step, avail);

			if (session > step + 1e-9) {
				yield [
					...blocks.slice(0, pos),
					{
						taskId: task.id,
						hours: session,
					},
					...blocks.slice(pos),
				];
			}
		}

		yield [
			...blocks.slice(0, pos),
			{
				taskId: null,
				hours: step,
			},
			...blocks.slice(pos),
		];
	}
}

function replaceAt(blocks: ScheduleBlock[], index: number, block: ScheduleBlock): ScheduleBlock[] {
	const next = [...blocks];
	next[index] = block;

	return next;
}

// ================== Budget curve (MATH.md §8.12) ==================

/** Top of the swept range, in hours — a day window past this is not advice. */
export const BUDGET_CURVE_MAX_HOURS = 12;

/** One swept day window and what the model does with it. */
export interface BudgetCurvePoint {
	budgetHours: number;
	/** Hours the optimizer books at this budget. */
	workHours: number;
	/**
	 * This budget's plan scored on the COMMON horizon — `objective` under a window
	 * of `maxBudgetHours` for every point, so the free-time term is
	 * `λ₀·(horizon − work)`: a constant, minus λ₀ per hour of work. Comparable
	 * across budgets, which `objective` at each point's own window is not.
	 * Running-max'd (MATH.md §8.12).
	 */
	dayValue: number;
	/**
	 * What an hour of window is worth around here — the slope of the CONCAVE
	 * MAJORANT of `dayValue`, not the raw step difference. Every point carries a
	 * real marginal, including the first: the majorant runs from the DO-NOTHING
	 * day (budget 0, scored on the same horizon), so the shortest window swept is
	 * measured against not working rather than against nothing at all.
	 *
	 * The raw difference asks "did this particular 45-minute step happen to seat
	 * another block", which is a question about the lattice and not about the
	 * day: `plan(b)` books whole steps, so `dayValue` is a staircase and its
	 * difference is a spike train that returns to zero and climbs back out — on
	 * 32 of 60 seeded days, up to 11 times (MATH.md §8.12, and see
	 * `scripts/curve-shape.probe.ts`). The hull slope asks the question the card
	 * actually poses: over the stretch of window the lattice needed in order to
	 * seat more work, what did an hour buy on average. It telescopes to the same
	 * total, and it is **non-increasing by construction**, so the curve falls and
	 * the LAST budget where it is still above zero is exactly `recommendedHours`.
	 *
	 * Net of λ₀, not gross: `dayValue`'s free-time term is `λ₀·(horizon − work)`,
	 * so the free time an extra hour of window costs is ALREADY charged here.
	 * Break-even is therefore **zero**. It must NOT be read against a λ₀ line —
	 * that would charge λ₀ twice, and the two readings disagree wildly: on a
	 * one-task day at the default λ₀ = 0.5 this crosses 0.5 at 3 h while the day's
	 * value goes on rising to 8.25 h (MATH.md §8.12).
	 */
	valuePerHour: number;
}

export interface BudgetCurve {
	points: BudgetCurvePoint[];
	/**
	 * Smallest budget reaching the best day value. Null in the two cases where
	 * the sweep has no window to name (MATH.md §8.12):
	 *
	 * - the best is at the top of the swept range — the model would use every hour
	 *   offered, so the answer is "the sweep ran out", not `maxBudgetHours`;
	 * - no budget beats the DO-NOTHING day — at a high enough λ₀ free time
	 *   outbids the whole board, and reading that off as the first swept step
	 *   would advertise a 45-minute day that books no work at all.
	 *
	 * The two read differently to the user, and `points` tells them apart: the
	 * second books zero work at every budget.
	 */
	recommendedHours: number | null;
	/** The λ₀ the sweep charged per worked hour — already inside `valuePerHour`,
	 *  so the card reports it as a price, never as a line to read the curve against. */
	freeTimeValue: number;
	/** Top of the swept range, so a null recommendation can name its own cap. */
	maxBudgetHours: number;
}

export interface BudgetCurveOptions {
	/** Top of the sweep. Default BUDGET_CURVE_MAX_HOURS. */
	maxBudgetHours?: number;
}

/**
 * Slopes of the least concave function that is ≥ `values` at every lattice
 * point, one per step, with 0 first — the marginal `suggestBudgetCurve` reports.
 *
 * Monotone-chain upper hull over `(i·step, values[i])`, then the covering edge's
 * slope for each step. Since `values` is non-decreasing, the slopes are ≥ 0 and
 * non-increasing, and they telescope to `last − first` exactly as the raw
 * differences do — the hull only redistributes the gain across the steps that
 * the block lattice lumped it into (MATH.md §8.12).
 */
function concaveMajorantSlopes(values: number[], step: number): number[] {
	const hull: number[] = [];

	for (let i = 0; i < values.length; i++) {
		// Drop the previous vertex whenever it sits on or below the chord that
		// skips it — the majorant runs above the staircase, so only strict
		// upward kinks survive.
		while (hull.length >= 2) {
			const a = hull[hull.length - 2];
			const b = hull[hull.length - 1];

			if ((values[b] - values[a]) * (i - a) <= (values[i] - values[a]) * (b - a)) hull.pop();
			else break;
		}

		hull.push(i);
	}

	const slopes = new Array<number>(values.length).fill(0);

	for (let edge = 1; edge < hull.length; edge++) {
		const from = hull[edge - 1];
		const to = hull[edge];
		const slope = (values[to] - values[from]) / ((to - from) * step);

		for (let i = from + 1; i <= to; i++) slopes[i] = slope;
	}

	return slopes;
}

/**
 * How the day's value responds to the day's LENGTH: one full solve per budget on
 * the step lattice, scored on a common horizon, plus the budget past which
 * another hour of window buys less than the free time it costs (MATH.md §8.12).
 *
 * The budget is the one model input that is a choice about today rather than a
 * measurement of the user, and it is the one the optimizer cannot pick for
 * itself: `objective` pays λ₀ for every free hour INSIDE the window, so it rises
 * with the window no matter what the day contains and its argmax is always "all
 * of it". Scoring every budget's plan on one horizon is what removes that — an
 * hour left free inside the window is worth λ₀ and so is the same hour outside
 * it, so the free-time term becomes a constant and only committed work is
 * charged.
 *
 * Deliberately NOT `objective − λ₀·budget`, which is the same idea applied to
 * each point's own window: the terminal term is read after the trailing rest, so
 * a longer window recovers more reservoir before it is valued and the reading
 * climbs on days that got no better. Measured, that artifact holds the
 * knee at the top of the range on every day until λ₀ = 1.25
 * (`scripts/budget-knee.probe.ts`).
 *
 * Running max on `dayValue`, with its own reason and caveat: the true
 * optimum is monotone in the budget (every plan feasible at `b` is feasible at
 * `b + ε`), but `plan(b)` maximizes `objective` at its OWN window rather than
 * this score, so the raw sweep can dip. The floor is in the direction
 * monotonicity allows and only ever hides a value the model rules out.
 *
 * `valuePerHour` is then the slope of the concave majorant of that level, not
 * its raw difference — see `BudgetCurvePoint.valuePerHour` and MATH.md §8.12.
 * Both the level and the majorant start from the DO-NOTHING day rather than
 * from the shortest window swept, which is also what lets `recommendedHours`
 * stay null on a day the model declines to work at any length.
 *
 * Cost: one `optimizeSchedule` per step — 16 solves at the default cap, each
 * priced by `scripts/energy-search-gap.probe.ts`. On-demand only; never a
 * `$derived`.
 */
export function suggestBudgetCurve(
	tasks: EnergyTaskInput[],
	params: EnergyParams = DEFAULT_ENERGY_PARAMS,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
	options: BudgetCurveOptions = {},
): BudgetCurve {
	const step = DEFAULT_STEP_HOURS;
	const horizon = options.maxBudgetHours ?? BUDGET_CURVE_MAX_HOURS;

	const curve: BudgetCurve = {
		points: [],
		recommendedHours: null,
		freeTimeValue: params.freeTimeValue,
		maxBudgetHours: horizon,
	};

	if (tasks.length === 0 || horizon < step) return curve;

	// One curve build for the whole sweep, as `optimizeSchedule` does per solve —
	// the common-horizon rescoring is what would otherwise rebuild them per point.
	const curves = buildCurves(tasks, constants, params);
	// The do-nothing day on the same horizon — budget 0, so the plan is empty by
	// definition and this costs no solve. Every reading below is against THIS and
	// not against the shortest window swept, which buys two things: the first
	// swept budget gets a real marginal instead of a forced zero, and `knee` needs
	// no sentinel. Seeded from `-Infinity` the first step always "rises", so a day
	// the model declines to work at any length — reachable well inside the λ₀
	// slider — is recommended 45 minutes that book nothing, on every such day
	// measured (MATH.md §8.12, `scripts/curve-shape.probe.ts`).
	const doNothing = evaluateWithCurves([], curves, horizon, params).objective;
	let best = doNothing;
	// The smallest budget reaching `best`, tracked as the sweep runs: since
	// `dayValue` is the running max, that is exactly the last budget at which it
	// rose. Read off the loop rather than searched for afterwards — a search has
	// to state what it does when nothing matches, and the only answer that could
	// ever be right is this one. Null while nothing has beaten `doNothing`.
	let knee: number | null = null;

	for (let budget = step; budget <= horizon + 1e-9; budget += step) {
		const plan = optimizeSchedule(tasks, budget, params, constants);
		const scored = evaluateWithCurves(plan.blocks, curves, horizon, params);

		if (scored.objective > best) {
			best = scored.objective;
			knee = budget;
		}

		curve.points.push({
			budgetHours: budget,
			workHours: plan.evaluation.workHours,
			dayValue: best,
			// Filled once the whole level is known — the majorant is a property of
			// the sweep, not of any one step.
			valuePerHour: 0,
		});
	}

	// Hulled WITH the do-nothing day in front, then that leading 0 dropped: the
	// budget-0 value is a real predecessor, so the shortest window swept is priced
	// against not working rather than left at 0 for want of one.
	const slopes = concaveMajorantSlopes([doNothing, ...curve.points.map((p) => p.dayValue)], step);

	for (let i = 0; i < curve.points.length; i++) curve.points[i].valuePerHour = slopes[i + 1];

	// Null at the top of the SWEPT range, which is the last budget on the lattice
	// and not `horizon` — they differ whenever the horizon is not a whole number of
	// steps, and comparing against the horizon there recommends the last swept
	// budget on a day that was still climbing when the sweep ran out. That is the
	// one case this null exists to distinguish.
	const last = curve.points[curve.points.length - 1];

	if (knee !== null && last !== undefined && knee < last.budgetHours - 1e-9)
		curve.recommendedHours = knee;

	return curve;
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
 * SENSITIVITY dD/dα (≈ 0.7–1.0 per unit α at the default α for typical 1–3h
 * full-demand sessions, ≈ 0.3–0.7 once α ≈ 0.5–0.8, vanishing as w → 0), so λ
 * is calibrated in those units, by probe
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
 * Weight ν₀ (pseudo-observations) of the noise floor in every calibration
 * fit's σ̂² blend: σ̂² = (ν₀σ₀² + SSR)/(ν₀ + n).
 *
 * WHY a separate constant (2026-07-19 math-review fix): the fits previously
 * reused their ridge strength λ as ν₀ ("like the ϕ fit", where λ = ν₀ = 4 by
 * coincidence). But λ here was probe-tuned for MAP responsiveness in each
 * fit's sensitivity units (0.25 / 0.05 / 1) — and as ν₀ those small values
 * erase the noise floors σ₀ at small n: a couple of lucky logs collapsed σ̂
 * far below the floor, and the reported ±std came out 2–10× tighter than a
 * floor-honest posterior (probe: 6 clean rest pairs reported r ± 0.036 —
 * 4% precision on recovery rate from six fuzzy self-ratings). The two roles
 * are unrelated: λ prices how far data moves the MAP; ν₀ says how much prior
 * evidence backs "ratings are at least this noisy". ν₀ = 4 matches the ϕ
 * fit's convention. MAP estimates are unchanged — only the reported stds.
 */
export const CALIBRATION_NOISE_PRIOR_WEIGHT = 4;

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
	params: Pick<EnergyParams, 'recoveryRate' | 'restRecoveryMultiplier' | 'microRecoveryFraction'>,
): DrainRateFit {
	const fit = fitRidge1D(
		observations,
		(o) => o.demand > 0 && o.hours > 0,
		fallbackAlpha,
		ALPHA_FIT_MIN,
		ALPHA_FIT_MAX,
		DRAIN_PRIOR_STRENGTH,
		DRAIN_NOISE_PRIOR_STD,
		(o) => clamp01(o.drainedFraction),
		(alpha, o) => {
			const law = reservoirLaw(
				clamp01(o.demand),
				alpha,
				params.recoveryRate,
				params.restRecoveryMultiplier,
				params.microRecoveryFraction,
			);

			return 1 - reservoirAt(1, law, o.hours);
		},
	);

	return {
		alpha: fit.value,
		fitted: fit.fitted,
		alphaStd: fit.std,
		usedCount: fit.usedCount,
	};
}

/**
 * Deterministic 1-D minimizer for the calibration fits: coarse grid to bracket
 * the global minimum (the ridge objectives are smooth but not provably
 * unimodal for adversarial data), then golden-section refinement.
 */
function minimizeSmooth1D(f: (x: number) => number, min: number, max: number): number {
	const GRID = 128;
	let bestIdx = 0;
	let bestVal = Infinity;

	for (let i = 0; i <= GRID; i++) {
		const x = min + ((max - min) * i) / GRID;
		const val = f(x);

		if (val < bestVal) {
			bestVal = val;
			bestIdx = i;
		}
	}

	const cell = (max - min) / GRID;
	let lo = Math.max(min, min + (bestIdx - 1) * cell);
	let hi = Math.min(max, min + (bestIdx + 1) * cell);
	const INV_PHI = (Math.sqrt(5) - 1) / 2;
	let x1 = hi - INV_PHI * (hi - lo);
	let x2 = lo + INV_PHI * (hi - lo);
	let f1 = f(x1);
	let f2 = f(x2);

	for (let i = 0; i < 48; i++) {
		if (f1 < f2) {
			hi = x2;
			x2 = x1;
			f2 = f1;
			x1 = hi - INV_PHI * (hi - lo);
			f1 = f(x1);
		} else {
			lo = x1;
			x1 = x2;
			f1 = f2;
			x2 = lo + INV_PHI * (hi - lo);
			f2 = f(x2);
		}
	}

	return (lo + hi) / 2;
}

/** Generic result of a 1-D ridge-to-prior calibration fit. */
interface Ridge1DFit {
	value: number;
	fitted: boolean;
	std?: number;
	usedCount: number;
}

/**
 * Shared skeleton of the α (fitDrainRate) and r (fitRecoveryRate) calibrations,
 * which are line-for-line structurally identical: filter to the informative
 * observations → 1-D ridge-to-prior minimized by minimizeSmooth1D →
 * inverse-gamma-style σ̂² blended with the noise floor as ν₀ pseudo-observations
 * → numeric-difference Laplace posterior std via the Gauss–Newton curvature
 * Σ(dD/dparam)² + λ. The fits differ only in the informative predicate, the
 * observed target, the prediction closure, the prior mean/strength (λ), the
 * noise prior, and the bounds — all parameters here.
 *
 * ν₀ stays CALIBRATION_NOISE_PRIOR_WEIGHT, deliberately decoupled from the ridge
 * λ (priorStrength) — the two roles are unrelated; see that constant's doc.
 */
function fitRidge1D<O>(
	observations: O[],
	informative: (o: O) => boolean,
	fallback: number,
	min: number,
	max: number,
	priorStrength: number,
	noisePriorStd: number,
	observed: (o: O) => number,
	predict: (param: number, o: O) => number,
): Ridge1DFit {
	const used = observations.filter(informative);

	if (used.length === 0) {
		return {
			value: fallback,
			fitted: false,
			usedCount: 0,
		};
	}

	const param0 = Math.min(Math.max(fallback, min), max);

	const ssr = (param: number): number => {
		let sum = 0;

		for (const o of used) {
			const resid = observed(o) - predict(param, o);
			sum += resid * resid;
		}

		return sum;
	};

	const objective = (param: number): number =>
		ssr(param) + priorStrength * (param - param0) * (param - param0);

	const value = minimizeSmooth1D(objective, min, max);
	const nu0 = CALIBRATION_NOISE_PRIOR_WEIGHT;
	const sigma2 = (nu0 * noisePriorStd * noisePriorStd + ssr(value)) / (nu0 + used.length);
	const h = 1e-4;
	let sensitivity = 0;

	for (const o of used) {
		const dD = (predict(value + h, o) - predict(value - h, o)) / (2 * h);
		sensitivity += dD * dD;
	}

	const std = Math.sqrt(sigma2 / (sensitivity + priorStrength));

	return {
		value,
		fitted: true,
		std,
		usedCount: used.length,
	};
}

// ================== Recovery-rate calibration (r fit) ==================

/**
 * One pre/post-rest rating pair, reduced to what the fit needs for ONE
 * reservoir: the user rested for `hours`, rating this reservoir
 * `drainedBefore` empty going into the break and `drainedAfter` coming out
 * (0–10 ratings divided by 10). Both reservoirs' pairs feed the SAME fit —
 * the model has a single shared recoveryRate, and at rest the law is
 * reservoir-independent.
 */
export interface RestObservation {
	/** Reported drain going into the rest, mapped to [0,1] */
	drainedBefore: number;
	/** Reported drain coming out of the rest, mapped to [0,1] */
	drainedAfter: number;
	/** Rest duration in hours */
	hours: number;
}

export interface RecoveryRateFit {
	/** MAP recovery rate r (the fallback when not fitted) */
	rate: number;
	fitted: boolean;
	/** Approximate posterior std of r (Gauss–Newton/Laplace); only when fitted */
	rateStd?: number;
	/** Informative observations used (drainedBefore > 0 and hours > 0) */
	usedCount: number;
}

/**
 * Prior strength λ for the recovery-rate ridge — same construction as
 * DRAIN_PRIOR_STRENGTH but calibrated to THIS fit's sensitivity units
 * (dD/dr = m·g·d_pre·e^(−r·m·g), whose measured range is §8.9's; with
 * x = r·m·g it is (d_pre/r)·x·e^(−x) and x·e^(−x) ≤ 1/e, so
 * dD/dr ≤ d_pre/(r·e) = 0.263 at half drain and the default r; and one logged
 * rest contributes TWO observations, mind + body). Probe-tuned 2026-07-18 to match
 * the α fit's behavior: one consistent logged rest moves r 53% of the way to
 * what it implies, three 71%, ten 88% (λ = 0.1 was too anchored at 39% for
 * the first log — re-measured 2026-08-06). MATH.md §8.9.
 */
export const RECOVERY_PRIOR_STRENGTH = 0.05;

/**
 * Prior scale for rest-rating noise. A residual here compares TWO fuzzy
 * ratings (before and after), so its noise is wider than a single drain
 * rating's by about √2: 0.15·√2 ≈ 0.21 of the drained fraction.
 */
export const RECOVERY_NOISE_PRIOR_STD = 0.21;

/**
 * Fit bounds = the Energy Lab's recovery-rate input range, so a fitted value
 * is always representable (and appliable) in the UI; doubles as the absurdity
 * guard, exactly like the α fit's bounds.
 */
export const RECOVERY_FIT_MIN = 0.1;

export const RECOVERY_FIT_MAX = 3;

/**
 * Calibrate the shared recovery rate r from pre/post-rest rating pairs.
 *
 * MODEL: during pure rest the reservoir law loses α entirely — demand 0 gives
 * ρ = r·m (m = restRecoveryMultiplier), C_eq = 1 — so the drained fraction
 * decays exponentially over a break of g hours:
 *
 *   d_after = d_before · e^(−r·m·g)
 *
 * This is why end-of-session ratings cannot identify r (MATH.md §8.7) but
 * pre/post-rest pairs can, and why this fit needs no α at all. It conditions
 * only on the CURRENT restRecoveryMultiplier — rest data identifies the
 * product r·m, so m stays user-owned and r absorbs the data, mirroring how
 * the α fit conditions on r. Together the two fits are well-founded rather
 * than circular: fit r first (α-free), then α conditions on it.
 *
 * FIT: 1-D ridge toward the default, same machinery as fitDrainRate.
 * Observations with drainedBefore = 0 or hours = 0 are dropped — the
 * prediction is then constant in r (nothing to recover / no time to recover
 * in), so the pair says nothing about r and would only pollute σ̂². A pair
 * with d_after > d_before (MORE drained after resting) is kept: no r can fit
 * it, so it pushes r toward the lower bound and widens σ̂ — noise handling is
 * the ridge's job and the bounds guard absurdity.
 */
export function fitRecoveryRate(
	observations: RestObservation[],
	fallbackRate: number,
	params: Pick<EnergyParams, 'restRecoveryMultiplier'>,
): RecoveryRateFit {
	const m = params.restRecoveryMultiplier;

	const fit = fitRidge1D(
		observations,
		(o) => o.drainedBefore > 0 && o.hours > 0,
		fallbackRate,
		RECOVERY_FIT_MIN,
		RECOVERY_FIT_MAX,
		RECOVERY_PRIOR_STRENGTH,
		RECOVERY_NOISE_PRIOR_STD,
		(o) => clamp01(o.drainedAfter),
		(rate, o) => clamp01(o.drainedBefore) * Math.exp(-rate * m * o.hours),
	);

	return {
		rate: fit.value,
		fitted: fit.fitted,
		rateStd: fit.std,
		usedCount: fit.usedCount,
	};
}

// ================== Stopping-value calibration (λ₀ fit) ==================

/**
 * One finished day, reduced to what the stopping fit needs: the day's task
 * list (that day's stored sliders), its declared window, and the hours
 * actually worked per task (from the 🪫 drain logs' worked-minutes field —
 * no new instrument). The fit reads the STOP decision out of this: the user
 * worked those hours and then chose leisure over every possible next block.
 */
export interface StopObservation {
	tasks: EnergyTaskInput[];
	/** The day's declared window (availableHours) */
	windowHours: number;
	/**
	 * One entry per logged SESSION (per-session 🪫 rows), with the row's
	 * own log moment where it has one. `endedAt` is what carries the day's block
	 * structure: consecutive rows' start/end times bracket the breaks between
	 * sessions, which is the difference between reading the day and repacking it
	 * (MATH.md §8.10). Omitted on any row → the day reads as summed per task.
	 */
	workedHours: { taskId: number; hours: number; endedAt?: number }[];
	/**
	 * Tasks still open at the stop — the only ones another session could have
	 * gone to (the next-up scope). A checked-off task's hours still shape
	 * the reconstruction, because they drained the reservoirs. Omitted means
	 * every task was open.
	 */
	openTaskIds?: ReadonlySet<number>;
}

/**
 * Logged hours summed per task, keeping only positive entries whose task is
 * still part of the day. ONE definition (AGENTS.md R3): the §8.10 stopping fit
 * and the adherence audit both read "what was actually worked" out of this
 * join, and they must agree about it or one of them is auditing a different day.
 *
 * Dropping unknown ids is the load-bearing part: a drain log outlives the task
 * it rated (deleting a task does not delete the measurement), and hours on a
 * task the day's plan never contained can be no part of a composition.
 */
export function workedHoursByTask(
	tasks: readonly { id: number }[],
	workedHours: readonly { taskId: number; hours: number }[],
): Map<number, number> {
	const byTask = new Map<number, number>();

	for (const { taskId, hours } of workedHours) {
		if (hours > 0 && tasks.some((task) => task.id === taskId)) {
			byTask.set(taskId, (byTask.get(taskId) ?? 0) + hours);
		}
	}

	return byTask;
}

export interface StopBracket {
	/** λ₀ ≥ lo, floored at 0; null when no step could be declined */
	lo: number | null;
	/** λ₀ ≤ hi; null when nothing carried a whole step */
	hi: number | null;
}

export interface StoppingValueFit {
	/** MAP freeTimeValue λ₀ (the fallback when not fitted) */
	value: number;
	fitted: boolean;
	/**
	 * Approximate posterior std of λ₀; only when fitted. WITHIN-MODEL, and that
	 * is load-bearing: it prices the day points' scatter around the fit, and
	 * every point was read under the SAME conditioning params, so a mis-set V_T
	 * slider moves them together and this number never widens for it (§8.10).
	 */
	valueStd?: number;
	/** Days that yielded a two-sided indifference point */
	usedCount: number;
	/** Days dropped because their span left no room for another step (§8.10) */
	clockCensoredCount: number;
}

/**
 * Prior strength for the stopping-value ridge. Here the "prediction" of a
 * day's indifference point by λ₀ is the IDENTITY (sensitivity exactly 1 per
 * observation), so the posterior mean has the closed form
 * (Σ midᵢ + λ·λ₀_default)/(n + λ) and the move-fraction profile is exact
 * arithmetic, no probe sweep needed: one day moves λ₀ 50% of the way to what
 * it implies, three 75%, ten 91% — matching the α/r fits' probe-tuned
 * profiles (§8.7/§8.9).
 */
export const STOP_PRIOR_STRENGTH = 1;

/**
 * Prior scale for indifference-point noise, in λ₀ units (output per hour).
 * Two sources add up: lattice quantization (the day's bracket is one 45-min
 * step wide — half-width a median 0.125 over 175 non-inverted days, measured
 * 2026-08-21 past the clock censor, with the days' own breaks in the
 * reconstruction; the 0.15 this comment first quoted was one probe day) and day-to-day mood in the stop
 * decision itself, which no instrument separates. 0.25 ≈ a quarter of
 * the informative λ₀ band ([0.4, 1.5] on the probe day).
 */
export const STOP_NOISE_PRIOR_STD = 0.25;

/**
 * Fit bounds = the Energy Lab's freeTimeValue input range (same
 * representability + absurdity-guard role as the α and r fit bounds).
 */
export const STOP_FIT_MIN = 0;

export const STOP_FIT_MAX = 3;

/**
 * Inversion margin for the stop bracket: a day with
 * max(0, lo) > hi + margin is censored as an interruption rather than kept.
 *
 * WHY (2026-07-19 math-review fix): lo > hi means the day's own data
 * contradicts the "stopped ⇒ λ₀ ≥ lo" reading — extending was worth MORE
 * than the best step actually worked, so the stop was not a leisure choice
 * (meeting, sickness, deadline elsewhere). Such a day degrades to the
 * one-sided reading λ₀ ≤ hi, i.e. exactly the censored category §8.10
 * already drops: keeping its midpoint as a point estimate pulls the fit
 * toward the task curves' characteristic marginal INDEPENDENT of the user's
 * true λ₀ (probe: a true λ₀ = 0.3 user's fit went 0.47 → 0.64 from two
 * interrupted days in five). The margin keeps near-boundary days, and small
 * inversions are within the instrument's own slack. Probe on the standard day:
 * interruption slivers gap 0.33–0.65 (censored), a mildly-off 2.25h reading
 * day gaps 0.07 (kept).
 *
 * CORRECTED 2026-08-06 (`scripts/stop-inversion-margin.probe.ts`, MATH.md
 * §8.10). Two claims that used to justify this number did not survive a wider
 * grid, so do not re-derive 0.25 from them:
 *
 *   - "rational days and rational-±1-step 'mood' days never invert at all" is
 *     FALSE for mood days — 47 of 926 invert, 14 of them censored, worst gap
 *     0.399 — so some honest days really are dropped. Re-read 2026-08-21 past
 *     the clock censor, with each day's own breaks in the reconstruction, where
 *     the optimizer's OWN plans do not invert at all: 0 of 191.
 *   - the "~+0.1 loose-max bias plus ~0.15 half-width" decomposition does not
 *     add up: measured, the bias is median 0.000 / mean 0.019 and the
 *     half-width median 0.125, summing to 0.125 — not 0.25.
 *
 * RE-DERIVED 2026-08-13 (`scripts/stop-margin-fit-error.probe.ts`, re-read
 * 2026-08-25) and it is not derivable: over [0.1, 0.5] the whole range moves λ₀
 * fit RMSE by at most 0.0072 — 2.9% of σ₀ — because most interrupted days never
 * invert at all (26.6% / 19.6% do, only 12.8% / 12.4% past 0.25), so censoring
 * cannot reach the contamination it exists for.
 * 0.25 is LEFT as an arbitrary point inside that flat region. The one real
 * signal is a SIGN, not a size: censoring nothing wins both contaminated arms,
 * by up to 0.0161, and ties the honest ones — recorded in §8.10, not acted on.
 */
export const STOP_INVERSION_MARGIN = 0.25;

/**
 * The day ran out of wall clock: worked hours plus the day's UNCAPPED recovered
 * breaks leave no room for another step, so its stop prices no leisure and
 * §8.10's fit drops it. A day with no recoverable break has no span to read.
 */
function isClockCensored(observation: StopObservation): boolean {
	const byTask = workedHoursByTask(observation.tasks, observation.workedHours);
	const rest = recoveredRest(observation, byTask);

	if (rest === null) return false;

	const total = [...byTask.values()].reduce((sum, hours) => sum + hours, 0);

	return total + rest.restTotal + DEFAULT_STEP_HOURS > observation.windowHours + 1e-9;
}

/**
 * A day's revealed bracket on the price of leisure, from discrete stationarity
 * of the user's OWN day (MATH.md §8.10). With the work-side value
 * V = satiatedOutput + terminalBonus (freeTimeValue never enters V — the
 * extraction is λ₀-free, no circularity):
 *
 *   stopped   ⇒  λ₀ ≥ max over open tasks of Δ(one more step on t)/step
 *   worked    ⇒  λ₀ ≤ max over worked tasks of Δ(last step of t)/step
 *
 * The first max is over the still-OPEN tasks (declining to extend AND
 * declining to start any unlogged task are both part of the stop decision; a
 * checked-off task is not, having no more of it to do); the second over tasks
 * with at least one whole step logged, completed or not (SOME worked step was
 * worth ≥ λ₀ — with unknown work order, the loose max is the honest bound).
 * Either side can be absent: no room to extend (worked to the window edge, on a
 * day whose rows recover no break — with one, the clock censor takes the day
 * whole instead) or nothing left open leaves `lo` null, and nothing worked a
 * whole step leaves `hi` null. Such a day carries only an inequality, so `fitStoppingValue` drops
 * it — the two sides are exported for the probes that had to rebuild them.
 * Null is the day that reveals nothing usable: neither bound, a bracket
 * inverted past the margin, or a day that ran out of wall clock
 * (`isClockCensored` — its own span left no room for another step, so the stop
 * was the clock's; `fitStoppingValue` counts those).
 *
 * The day is reconstructed from the 🪫 rows' own log moments: one session per
 * row, in the order they were logged, the space between them rest. A day with
 * no usable moment, and a day logged in one batch, fall back to one contiguous
 * session per task in canonical amplitude order — the reading every day used to
 * get. Measured 2026-08-19 over 676
 * optimizer-funded cells drawn through `toEnergyTask` at λ₀ 0.1 … 1.1
 * (`scripts/stop-block-structure.probe.ts`):
 * |midpoint − true λ₀| mean 0.060, p90 0.116 over the 307 cells this reader
 * prices SINCE the clock censor (2026-08-21), against 0.086 / 0.171 over the 441
 * it priced before it and 0.123 / 0.271 summed — and the error is λ₀-DEPENDENT, mean 0.300 at λ₀ = 0.1
 * against 0.053 at 0.9, so a figure from here carries the λ₀ it was read at.
 * Containment is measured rather than asserted: it failed on 61 of the 441
 * pre-censor cells and on 1 of the 307 priced now, and the class carrying it — the day whose own span left no room
 * for another step, one-signed HIGH — is censored since 2026-08-21 (§8.10).
 * The negative side of the stop bound is floored at 0 — λ₀ ≥ (negative
 * marginal) is vacuous, and 0 is the fit's own lower bound, so the floor
 * projects onto the feasible set rather than inventing a bound. Such a day
 * still reads TWO-SIDED: its midpoint is hi/2, half a parameter edge rather
 * than two measured bounds, and it carries a full day's weight in the fit.
 *
 * An IRRATIONAL day can invert the bracket (lo > hi: extending some task was
 * worth more per step than the best step actually worked — e.g. a session cut
 * short mid-warm-up, or a long grind on a weak, satiating task while a
 * high-amplitude task sat unstarted). No λ₀ rationalizes such a day.
 * Inversions beyond STOP_INVERSION_MARGIN are censored (returned as null):
 * the contradiction is evidence the stop was not a leisure choice, so only
 * the one-sided λ₀ ≤ hi reading survives — the same reason a day worked to the
 * window edge with no recovered break is dropped. Small inversions (within the margin, i.e. within the
 * instrument's own slack) keep the bracket midpoint as the compromise between
 * the two bounds. Near-rational days (±1 step of "mood") invert
 * RARELY but not never — 47 of 926, 14 of them past the margin — while the
 * app's own plans, read with their breaks, invert 0 of 191 (2026-08-21, see
 * STOP_INVERSION_MARGIN).
 */
export function stopBracket(
	observation: StopObservation,
	params: EnergyParams,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
): StopBracket | null {
	if (isClockCensored(observation)) return null;

	const day = reconstructStopDay(observation, params, constants);

	if (day === null || day.byTask.size === 0) return null;

	const step = DEFAULT_STEP_HOURS;

	const nextStep =
		day.total + step <= observation.windowHours + 1e-9
			? (bestNextStep(day)?.marginalValue ?? null)
			: null;

	let hi: number | null = null;

	for (const t of observation.tasks) {
		if ((day.byTask.get(t.id) ?? 0) >= step - 1e-9) {
			const dLast = (day.base - day.workValue(shrinkBy(day, t.id, step))) / step;
			hi = hi === null ? dLast : Math.max(hi, dLast);
		}
	}

	const lo = nextStep === null ? null : Math.max(0, nextStep);

	if (lo === null && hi === null) return null;

	// Interruption-censored: the day's data contradicts a rational stop by more
	// than the instrument's slack — see STOP_INVERSION_MARGIN.
	if (lo !== null && hi !== null && lo > hi + STOP_INVERSION_MARGIN) return null;

	return {
		lo,
		hi,
	};
}

/** The bracket's midpoint, or null on a day that reveals only one side. */
export function stopIndifferencePoint(
	observation: StopObservation,
	params: EnergyParams,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
): number | null {
	const bracket = stopBracket(observation, params, constants);

	if (bracket === null || bracket.lo === null || bracket.hi === null) return null;

	return (bracket.lo + bracket.hi) / 2;
}

/**
 * The reconstructed day the two stop readings share (§8.10/§8.11): the logged
 * sessions in the order and with the breaks their own log moments give, plus
 * the λ₀-free work value V = satiatedOutput + terminalBonus evaluated around
 * it. `total` is the WORKED hours and `span` adds the day's UNCAPPED recovered
 * breaks, `total` when none is recoverable. The two readings split there:
 * §8.11's `window-full` verdict reads `total`, because a verdict must not turn
 * on recovered structure, while §8.10's clock censor and the session lengths
 * §8.11 prices read `span` (MATH.md §8.10/§8.11).
 */
interface StopDayReconstruction {
	/** The tasks another session could have gone to (`openTaskIds`) */
	candidates: EnergyTaskInput[];
	sched: ScheduleBlock[];
	byTask: Map<number, number>;
	rank: Map<number, number>;
	windowHours: number;
	total: number;
	span: number;
	base: number;
	workValue: (blocks: ScheduleBlock[]) => number;
}

function reconstructStopDay(
	observation: StopObservation,
	params: EnergyParams,
	constants: UserConstants,
): StopDayReconstruction | null {
	const { tasks, windowHours, openTaskIds } = observation;

	if (windowHours <= 0 || tasks.length === 0) return null;

	const byTask = workedHoursByTask(tasks, observation.workedHours);
	// Canonical amplitude order over ALL of the day's tasks: the rank orders the
	// fallback schedule, and doubles as the insertion point when an UNLOGGED task
	// is probed in `bestNextStep`.
	const canonical = [...tasks].sort((x, y) => taskAmplitude(y) - taskAmplitude(x));
	const rank = new Map(canonical.map((t, i) => [t.id, i]));
	const total = [...byTask.values()].reduce((sum, hours) => sum + hours, 0);
	const rest = recoveredRest(observation, byTask);

	const sched: ScheduleBlock[] =
		loggedStructure(rest, windowHours, total) ??
		canonical
			.filter((t) => byTask.has(t.id))
			.map((t) => ({
				taskId: t.id,
				hours: byTask.get(t.id)!,
			}));

	const curves = buildCurves(tasks, constants, params);

	const workValue = (blocks: ScheduleBlock[]): number => {
		const ev = evaluateWithCurves(blocks, curves, windowHours, params);

		return ev.satiatedOutput + ev.terminalBonus;
	};

	return {
		candidates: openTaskIds === undefined ? tasks : tasks.filter((t) => openTaskIds.has(t.id)),
		sched,
		byTask,
		rank,
		windowHours,
		total,
		span: total + (rest?.restTotal ?? 0),
		base: workValue(sched),
		workValue,
	};
}

/** Milliseconds per hour: `endedAt` is a wall clock, `hours` is not. */
const MS_PER_HOUR = 3_600_000;

interface RecoveredRest {
	/** The day's logged rows in log order */
	rows: StopObservation['workedHours'];
	/** The break before each row, `rows[0]`'s being 0 */
	gaps: number[];
	restTotal: number;
}

/**
 * The breaks the 🪫 rows' own log moments recover — one row per session,
 * so `endedAt − hours` starts it and the space before it is a break the summed
 * reading used to throw away (MATH.md §8.10). Both stop readings need this
 * before the reconstruction caps it, so it is its own function.
 *
 * Null when the timestamps cannot carry it: a row without a usable moment (a
 * restored backup can carry one — `sanitizeDrainObservations` does not check the
 * field, and must not, since §8.7's α fit does not need it), or a day whose rows
 * recover no gap at all, which is what batch logging looks like.
 */
function recoveredRest(
	observation: StopObservation,
	byTask: Map<number, number>,
): RecoveredRest | null {
	const rows = observation.workedHours.filter((r) => r.hours > 0 && byTask.has(r.taskId));

	if (rows.some((r) => !Number.isFinite(r.endedAt))) return null;

	const sorted = [...rows].sort((x, y) => x.endedAt! - y.endedAt!);

	// A negative delta (a clock adjustment, or two rows logged out of order)
	// floors at 0 — the sessions read as adjacent, which is today's behaviour.
	const gaps = sorted.map((r, i) =>
		i === 0
			? 0
			: Math.max(0, (r.endedAt! - r.hours * MS_PER_HOUR - sorted[i - 1].endedAt!) / MS_PER_HOUR),
	);

	const restTotal = gaps.reduce((sum, gap) => sum + gap, 0);

	if (!(restTotal > 1e-9)) return null;

	return {
		rows: sorted,
		gaps,
		restTotal,
	};
}

/**
 * The day's real block structure: the recovered sessions and the breaks between
 * them, or null when the caller must fall back to the contiguous canonical
 * schedule for the WHOLE day.
 *
 * Recovered rest is scaled down to leave one step of room. That keeps `total`'s
 * window arithmetic and `normalizeSchedule`'s clip behaving as they do on the
 * contiguous reading, at the price of understating breaks on days whose logged
 * span nearly fills the declared window — which is why the clock censor reads
 * the UNCAPPED span instead (MATH.md §8.10).
 */
function loggedStructure(
	rest: RecoveredRest | null,
	windowHours: number,
	total: number,
): ScheduleBlock[] | null {
	if (rest === null) return null;

	const { rows, gaps, restTotal } = rest;
	const room = Math.max(0, windowHours - total - DEFAULT_STEP_HOURS);
	const scale = Math.min(1, room / restTotal);

	if (!(restTotal * scale > 1e-9)) return null;

	const sched: ScheduleBlock[] = [];

	rows.forEach((r, i) => {
		const gap = gaps[i] * scale;

		if (gap > 1e-9)
			sched.push({
				taskId: null,
				hours: gap,
			});

		sched.push({
			taskId: r.taskId,
			hours: r.hours,
		});
	});

	return sched;
}

/**
 * The reconstructed day grown by `hours` more on task `t`, at the LAST of its
 * blocks — the day continues from where it stopped. An unlogged task is
 * inserted at ITS canonical position, not appended last: block order changes
 * the marginal through the reservoirs, so appending made the reading depend on
 * an arbitrary convention rather than on the day. Where that position falls
 * beside a break, the session lands before the break, i.e. directly after the
 * last lower-ranked work block.
 */
function growBy(day: StopDayReconstruction, t: EnergyTaskInput, hours: number): ScheduleBlock[] {
	if (day.byTask.has(t.id)) {
		const last = lastBlockOf(day.sched, t.id);

		return day.sched.map((b, i) =>
			i === last
				? {
						...b,
						hours: b.hours + hours,
					}
				: b,
		);
	}

	const before = day.sched.filter(
		(b) => b.taskId !== null && day.rank.get(b.taskId)! < day.rank.get(t.id)!,
	).length;

	let at = 0;

	for (let seen = 0; seen < before; at++) if (day.sched[at].taskId !== null) seen++;

	return [
		...day.sched.slice(0, at),
		{
			taskId: t.id,
			hours,
		},
		...day.sched.slice(at),
	];
}

/** Index of the last block on `taskId`; callers only ask about worked tasks. */
function lastBlockOf(sched: ScheduleBlock[], taskId: number): number {
	return sched.reduce((last, b, i) => (b.taskId === taskId ? i : last), -1);
}

/**
 * The reconstructed day with `hours` taken off the END of task `t`'s work —
 * §8.10's `hi` side, "the last step of t undone". It walks back across the
 * task's blocks because a task can now hold several, and its final session can
 * itself be shorter than one step (two half-hour rows are an ordinary day).
 */
function shrinkBy(day: StopDayReconstruction, taskId: number, hours: number): ScheduleBlock[] {
	const out = [...day.sched];
	let left = hours;

	for (let i = out.length - 1; i >= 0 && left > 1e-9; i--) {
		if (out[i].taskId !== taskId) continue;

		const take = Math.min(out[i].hours, left);

		out[i] = {
			...out[i],
			hours: out[i].hours - take,
		};

		left -= take;
	}

	return out.filter((b) => b.hours > 1e-9);
}

/**
 * max over the day's still-OPEN tasks of Δ(one more step on t)/step — §8.10's
 * `lo` bound. Declining to extend a logged task and declining to START an
 * unlogged one are both part of the stop decision, so both are probed; a task
 * already checked off is not, because there was no more of it to do. Null when
 * nothing was left open. Callers guarantee a whole step fits.
 */
function bestNextStep(
	day: StopDayReconstruction,
): { taskId: number; marginalValue: number } | null {
	const step = DEFAULT_STEP_HOURS;
	let best: { taskId: number; marginalValue: number } | null = null;

	for (const t of day.candidates) {
		const dNext = (day.workValue(growBy(day, t, step)) - day.base) / step;

		if (best === null || dNext > best.marginalValue) {
			best = {
				taskId: t.id,
				marginalValue: dNext,
			};
		}
	}

	return best;
}

/**
 * The live stop advisor's verdict on the day so far (MATH.md §8.11): either a
 * priced best next session, or the fact that no whole step fits the window.
 */
export type StopAdvice =
	| {
			verdict: 'continue' | 'stop';
			/** The task whose next session is worth the most right now */
			taskId: number;
			/** That best session's length — a whole number of 45-min steps */
			sessionHours: number;
			/** Its average work-value gain per hour — same units as freeTimeValue */
			marginalValue: number;
	  }
	| {
			verdict: 'window-full';
	  };

/**
 * §8.10's stop reading run forward mid-day instead of on a finished one
 * (MATH.md §8.11): given the work logged so far, price the best next SESSION —
 * max over (task, whole-step duration) of average work-value gain per hour,
 * the same λ₀-free value the stopping fit brackets with — and compare it
 * against the CURRENT freeTimeValue. Continue while some session still beats
 * an hour of leisure, stop at indifference or below.
 *
 * Sessions, not single steps, on purpose: a fresh task's first 45 min is
 * mostly warm-up ramp, so its one-step marginal sits below a λ₀ the full
 * session clears — probe 2026-08-06, re-read 2026-08-27 once its days were
 * drawn on the slider surface (ROADMAP M49): the one-step verdict cries stop
 * mid-day on 14.2% of checkpoints at λ₀ = 0.9 and 28.1% at 1.3,
 * session-lookahead on 1.3% and 0.0%, with at-stop agreement identical between
 * the two arms in every row (§8.11). The duration axis is the optimizer's
 * own move shape (grow / T*-session insert), so at a rational stop no session
 * clears λ₀ and the verdicts still agree.
 *
 * Only `openTaskIds` may be RECOMMENDED — "one more session of a task you
 * already checked off" is no advice — while every logged task still shapes the
 * reconstruction: a completed task's hours drained the reservoirs the open
 * ones must work with. The retrospective fit reads the same set for the same
 * reason (§8.10).
 *
 * NO INVERSION CENSOR, deliberately (MATH.md §8.11). §8.10's `stopBracket`
 * drops a day whose bracket inverts past `STOP_INVERSION_MARGIN`; this reads
 * the same reconstruction and refuses no day. Mid-day `lo > hi` is not the
 * contradiction it is retrospectively — there is no stop yet to rationalize,
 * only a better step available than the one last worked, which is when
 * `continue` is RIGHT. Measured 2026-08-27 (`stop-advisor.probe.ts`): the
 * inverted cell is 8.3–16.4% of the checkpoints the card speaks on and carries
 * zero mid-day false stops at every λ₀ on both populations, so carrying the
 * censor would silence hundreds of correct verdicts and remove none that were
 * wrong.
 *
 * Null when there is nothing to advise on (no window, no tasks, or no
 * candidate left); `window-full` when no whole step fits in what remains of
 * the window — logged hours filled it, or the window is smaller than one step.
 * That gate reads WORKED hours; only the session LENGTHS priced past it read the
 * day's recovered span — `reconstructStopDay`'s own `span`, the quantity §8.10's
 * clock censor tests (MATH.md §8.11).
 */
export function adviseStop(
	observation: StopObservation,
	params: EnergyParams,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
): StopAdvice | null {
	const day = reconstructStopDay(observation, params, constants);

	if (day === null || day.candidates.length === 0) return null;

	const step = DEFAULT_STEP_HOURS;
	const room = Math.floor((observation.windowHours - day.total) / step + 1e-9);

	if (room < 1) {
		return {
			verdict: 'window-full',
		};
	}

	// The session priced must fit the clock the day has LEFT, not the hours it
	// worked (MATH.md §8.11). Floored at one step: a day already past its window
	// is still advised on, at the smallest session there is.
	const longest = Math.max(
		1,
		Math.min(room, Math.floor((observation.windowHours - day.span) / step + 1e-9)),
	);

	let best: { taskId: number; sessionHours: number; marginalValue: number } | null = null;

	for (const t of day.candidates) {
		for (let m = 1; m <= longest; m++) {
			const hours = m * step;
			const avg = (day.workValue(growBy(day, t, hours)) - day.base) / hours;

			if (best === null || avg > best.marginalValue) {
				best = {
					taskId: t.id,
					sessionHours: hours,
					marginalValue: avg,
				};
			}
		}
	}

	return {
		verdict: best!.marginalValue > params.freeTimeValue ? 'continue' : 'stop',
		...best!,
	};
}

/**
 * Calibrate freeTimeValue λ₀ from finished days' stop decisions.
 *
 * MODEL: each two-sided day yields an indifference point mᵢ (above); treat
 * mᵢ = λ₀ + noise. The prediction is the identity, so the ridge MAP
 *
 *   minimize Σᵢ (mᵢ − λ₀)² + λ·(λ₀ − λ₀_default)²
 *
 * has the exact closed form below — same machinery as §8.7/§8.9 with
 * dD/dλ₀ = 1 (no numeric minimizer needed). A one-sided day is dropped, like
 * demand-0 drain logs: it reveals an inequality, not an indifference, and
 * keeping the bound as a point would bias the mean. Entering it as a censored
 * likelihood term instead was built and MEASURED 2026-08-21, and does not pay
 * — §8.10's censored-likelihood paragraph carries the numbers.
 *
 * CONDITIONING: the extraction runs under the CURRENT dynamics
 * (α, r, m, b, satietyScale) and terminalEnergyValue — λ₀ absorbs the stop
 * data given everything else, mirroring how α conditions on r (§8.7). V_T is
 * deliberately NOT fit, and NOT because stop times are blind to it — the
 * 2026-07-19 "moved the stop across two lattice levels" reading is withdrawn.
 * Over 300 seeded slider-reachable days the same sweep moves the stop by a
 * median 1 step and 5 at worst, non-monotonically on 25 of them (§8.10
 * feasibility 2, 2026-08-21). V_T stays user-owned because it is a preference
 * the slider states, not because it is unidentifiable; a slider left far from
 * the truth is a real unfitted error source, and `valueStd` cannot see it —
 * every day is read under the same slider, so a mis-set V_T slides the whole
 * fit without widening the ±: up to 3.3× that ± over the slider's own range,
 * `usedCount` unchanged (2026-08-24, `stp-stopping-identifiability.probe.ts`).
 * Calibrate r and α first; this fit inherits their quality.
 */
export function fitStoppingValue(
	observations: StopObservation[],
	fallbackValue: number,
	params: EnergyParams,
	constants: UserConstants = DEFAULT_USER_CONSTANTS,
): StoppingValueFit {
	const points = observations
		.map((o) => stopIndifferencePoint(o, params, constants))
		.filter((p): p is number => p !== null);

	const clockCensoredCount = observations.filter(isClockCensored).length;

	if (points.length === 0) {
		return {
			value: fallbackValue,
			fitted: false,
			usedCount: 0,
			clockCensoredCount,
		};
	}

	const value0 = Math.min(Math.max(fallbackValue, STOP_FIT_MIN), STOP_FIT_MAX);
	const n = points.length;

	const mean =
		(points.reduce((s, p) => s + p, 0) + STOP_PRIOR_STRENGTH * value0) / (n + STOP_PRIOR_STRENGTH);

	const value = Math.min(Math.max(mean, STOP_FIT_MIN), STOP_FIT_MAX);
	// Noise estimate and Laplace posterior std, the §8.7/§8.9 construction
	// with sensitivity Σ(dpred/dλ₀)² = n exactly.
	const nu0 = CALIBRATION_NOISE_PRIOR_WEIGHT;
	const ssr = points.reduce((s, p) => s + (p - value) * (p - value), 0);
	const sigma2 = (nu0 * STOP_NOISE_PRIOR_STD * STOP_NOISE_PRIOR_STD + ssr) / (nu0 + n);
	const valueStd = Math.sqrt(sigma2 / (n + STOP_PRIOR_STRENGTH));

	return {
		value,
		fitted: true,
		valueStd,
		usedCount: n,
		clockCensoredCount,
	};
}
