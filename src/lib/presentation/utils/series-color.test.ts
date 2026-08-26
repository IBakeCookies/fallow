import { describe, expect, it } from 'vitest';
import { seriesColors } from '$lib/presentation/utils/series-color';

describe('seriesColors', () => {
	// Plan order, not task id: the bar, the schedule list and the task rows are three
	// renderings of one assignment, and a per-caller order would disagree between them.
	it('assigns the scale in plan order', () => {
		const { colorOf } = seriesColors([7, 3, 42]);

		expect([colorOf(7), colorOf(3), colorOf(42)]).toEqual([
			'var(--series-1)',
			'var(--series-2)',
			'var(--series-3)',
		]);
	});

	// Eight hues and no cap on tasks, so the ninth shares with the first rather than
	// rendering `var(--series-9)`, which no theme defines — an unpainted block.
	it('wraps the ninth task back onto the first hue', () => {
		const { colorOf } = seriesColors([1, 2, 3, 4, 5, 6, 7, 8, 9]);

		expect(colorOf(9)).toBe(colorOf(1));
		expect(colorOf(8)).toBe('var(--series-8)');
	});

	it.each([
		['a rest block', null],
		['a task the plan never funded', 99],
	])('paints %s with the rest colour', (_case, taskId) => {
		const { colorOf } = seriesColors([1]);

		expect(colorOf(taskId)).toBe('var(--series-rest)');
	});
});
