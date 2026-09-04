import { describe, expect, it } from 'vitest';
import { describeDraftCost } from '$lib/presentation/utils/draft-cost-descriptor';

describe('describeDraftCost', () => {
	/* A name beats a total: the task the day stops funding is the cost the user
	   can act on, so it wins over the hours even when hours were also taken. */
	it('names the tasks the day stops funding', () => {
		expect(
			describeDraftCost({
				hoursTaken: 2.5,
				taskCount: 2,
				unfunded: ['Write report', 'Gym'],
			}),
		).toBe('unfunds Write report, Gym');
	});

	it('counts the tasks that only lost hours', () => {
		expect(
			describeDraftCost({
				hoursTaken: 0.67,
				taskCount: 3,
				unfunded: [],
			}),
		).toBe('40m from 3 tasks');
	});

	/* One task is not "1 tasks": the plural is a separate message, and this is
	   the commonest cost of a small draft. */
	it('says one task in the singular', () => {
		expect(
			describeDraftCost({
				hoursTaken: 1.5,
				taskCount: 1,
				unfunded: [],
			}),
		).toBe('1h 30m from 1 task');
	});

	/* Said rather than dropped: a missing cost line reads as a panel that failed
	   to render one. */
	it('says a draft that costs the day nothing', () => {
		expect(
			describeDraftCost({
				hoursTaken: 0,
				taskCount: 0,
				unfunded: [],
			}),
		).toBe('takes nothing from the day');
	});
});
