import { describe, it, expect } from 'vitest';
import { summarizeDeclaredConstraints } from '$lib/business/model/constraint-memory';
import { DEFAULT_SWITCH_COST, DEFAULT_CAPACITY_POOLS } from '$lib/business/model/zenith';
import type { DailySession } from '$lib/data/type';

const session = (date: string, switchCost: number, pools?: [number, number]): DailySession => {
	const stored: DailySession = {
		date,
		tasks: [],
		availableHours: 4,
		switchCost,
		updatedAt: 0,
	};

	if (pools) {
		stored.cognitivePool = pools[0];
		stored.physicalPool = pools[1];
	}

	return stored;
};

describe('summarizeDeclaredConstraints', () => {
	it('carries the last stored day, whatever order the days arrive in', () => {
		const declared = summarizeDeclaredConstraints([
			session('2026-08-03', 0.5, [3, 5]),
			session('2026-08-10', 0.75, [2, 8]),
			session('2026-08-05', 0.1, [9, 9]),
		]);

		expect(declared.switchCost).toBe(0.75);

		expect(declared.pools).toEqual({
			cognitiveHours: 2,
			physicalHours: 8,
		});
	});

	it('offers the constants when nothing has ever been stored', () => {
		expect(summarizeDeclaredConstraints([])).toEqual({
			switchCost: DEFAULT_SWITCH_COST,
			pools: DEFAULT_CAPACITY_POOLS,
		});
	});

	// Pools are optional in storage, so the newest day may have none while an
	// older one declared them. Each field answers from its own latest day.
	it('reads the pools past a newer day that has none', () => {
		const declared = summarizeDeclaredConstraints([
			session('2026-08-03', 0.5, [3, 5]),
			session('2026-08-10', 0.75),
		]);

		expect(declared.switchCost).toBe(0.75);

		expect(declared.pools).toEqual({
			cognitiveHours: 3,
			physicalHours: 5,
		});
	});

	// A record with one pool is corrupt, not a declaration: the writers only ever
	// write the pair, so half of one says nothing about the capacity of either.
	it('reads half a pool pair as no declaration', () => {
		const halved = session('2026-08-10', 0.75, [2, 8]);

		delete halved.physicalPool;

		expect(
			summarizeDeclaredConstraints([session('2026-08-03', 0.5, [3, 5]), halved]).pools,
		).toEqual({
			cognitiveHours: 3,
			physicalHours: 5,
		});
	});
});
