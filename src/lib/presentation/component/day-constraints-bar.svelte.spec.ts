import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { FlowObservationRecord } from '$lib/business/type';
import DayConstraintsBar from '$lib/presentation/component/day-constraints-bar.svelte';

const props = {
	availableHours: 6,
	switchCost: 0.25,
	cognitivePool: 4,
	physicalPool: 3,
	remainingSuggestedHours: '3.50',
	planSlackHours: 0,
	constantsFitted: false,
};

const log = (id: number, taskTitle: string, phiHours: number): FlowObservationRecord => ({
	id,
	date: '2026-07-19',
	taskId: id,
	taskTitle,
	difficulty: 6,
	enjoyment: 7,
	E: 3,
	beta: 1.7,
	phiHours,
	createdAt: id,
});

const logs = [log(1, 'boxing', 0.5), log(2, 'writing', 0.25)];

describe('day-constraints-bar.svelte', () => {
	it('collapsed, every constraint the plan reads fits on one line', async () => {
		render(DayConstraintsBar, {
			...props,
			planSlackHours: 1.25,
		});

		await expect
			.element(
				page.getByText('6h budget · 3.50h planned · 1.25h free · 4h mind · 3h body · 15m switch'),
			)
			.toBeInTheDocument();

		await expect
			.element(
				page.getByRole('button', {
					name: /Time Budget/,
				}),
			)
			.toHaveAttribute('aria-expanded', 'false');
	});

	it('omits the slack segment when the plan fills the budget', async () => {
		render(DayConstraintsBar, props);

		await expect
			.element(page.getByText('6h budget · 3.50h planned · 4h mind · 3h body · 15m switch'))
			.toBeInTheDocument();
	});

	it('expanded, shows all four inputs with switch cost in minutes', async () => {
		render(DayConstraintsBar, {
			...props,
			startOpen: true,
		});

		await expect.element(page.getByLabelText('Available Hours')).toHaveValue(6);
		await expect.element(page.getByLabelText('Switch Cost (per task change)')).toHaveValue(15);
		await expect.element(page.getByLabelText('Cognitive Capacity')).toHaveValue(4);
		await expect.element(page.getByLabelText('Physical Capacity')).toHaveValue(3);
		await expect.element(page.getByText('Allocated: 3.50h')).toBeInTheDocument();
	});

	it('stepping switch cost converts minutes back to hours', async () => {
		render(DayConstraintsBar, {
			...props,
			startOpen: true,
		});

		// second "Increase" stepper belongs to switch cost: 15 min → 20 min = 1/3 h
		await page
			.getByRole('button', {
				name: 'Increase',
			})
			.nth(1)
			.click();

		await expect.element(page.getByLabelText('Switch Cost (per task change)')).toHaveValue(20);
	});

	// The model's state is derived from the fit flag plus the log count. Two of the
	// three reach the collapsed bar: a rejected fit (a mistyped log to go fix) and
	// no logs at all (the only sentence in the app that says ⚡ exists). A healthy
	// fit is reassurance and stays inside.
	it('surfaces a rejected fit while collapsed', async () => {
		render(DayConstraintsBar, {
			...props,
			flowLogs: logs,
		});

		await expect
			.element(page.getByText(/Your 2 flow logs produced an implausible fit/))
			.toBeInTheDocument();
	});

	it('prompts for a first flow log while collapsed', async () => {
		render(DayConstraintsBar, props);

		await expect
			.element(
				page.getByRole('button', {
					name: /Time Budget/,
				}),
			)
			.toHaveAttribute('aria-expanded', 'false');

		// Not the warning colour — nothing is wrong, there is just nothing logged yet
		await expect
			.element(page.getByText(/Model uses default constants/))
			.toHaveClass(/text-ty-silent/);
	});

	// The bar renders on a future day, but no task there offers a ⚡ button
	it('does not prompt on a day whose tasks cannot be logged', async () => {
		render(DayConstraintsBar, {
			...props,
			canLogFlow: false,
		});

		// The summary line proves the bar rendered — otherwise the absence below is
		// satisfied by nothing having rendered at all
		await expect
			.element(page.getByText('6h budget · 3.50h planned · 4h mind · 3h body · 15m switch'))
			.toBeInTheDocument();

		expect(page.getByText(/Model uses default constants/).elements()).toHaveLength(0);
	});

	it.each([
		[logs, /Model personalized from 2 time-to-flow logs/],
		[[logs[0]], /Model personalized from 1 time-to-flow log/],
	])('collapsed, keeps a healthy fit quiet (%# logs)', async (flowLogs, quiet) => {
		render(DayConstraintsBar, {
			...props,
			constantsFitted: true,
			flowLogs,
		});

		expect(page.getByText(quiet).elements()).toHaveLength(0);

		// …and states it inside, as the log-list toggle
		await page
			.getByRole('button', {
				name: /Time Budget/,
			})
			.click();

		await expect.element(page.getByText(quiet)).toBeInTheDocument();
	});

	it('expands to list logs newest-first with measured flow minutes', async () => {
		render(DayConstraintsBar, {
			...props,
			constantsFitted: true,
			flowLogs: logs,
			startOpen: true,
		});

		await page
			.getByRole('button', {
				name: /Model personalized from 2 time-to-flow logs/,
			})
			.click();

		await expect.element(page.getByText('· boxing')).toBeInTheDocument();
		await expect.element(page.getByText('⚡ 30m')).toBeInTheDocument();
		const titles = [...document.querySelectorAll('li')].map((li) => li.textContent);
		expect(titles[0]).toContain('writing');
		expect(titles[1]).toContain('boxing');
	});

	it('deletes a single log by id', async () => {
		const ondeletelog = vi.fn();

		render(DayConstraintsBar, {
			...props,
			flowLogs: logs,
			ondeletelog,
			startOpen: true,
		});

		await page
			.getByRole('button', {
				name: /implausible fit/,
			})
			.click();

		await page
			.getByRole('button', {
				name: 'Delete this flow log',
			})
			.first()
			.click();

		// list is newest-first, so the first ✕ belongs to log id 2
		expect(ondeletelog).toHaveBeenCalledExactlyOnceWith(2);
	});

	it('resets all logs only after confirmation', async () => {
		const onresetlogs = vi.fn();

		render(DayConstraintsBar, {
			...props,
			flowLogs: logs,
			onresetlogs,
			startOpen: true,
		});

		await page
			.getByRole('button', {
				name: /implausible fit/,
			})
			.click();

		await page
			.getByRole('button', {
				name: 'Reset personalization',
			})
			.click();

		expect(onresetlogs).not.toHaveBeenCalled();

		await expect
			.element(page.getByText('Delete all 2 logs and revert to defaults?'))
			.toBeInTheDocument();

		await page
			.getByRole('button', {
				name: 'Reset',
				exact: true,
			})
			.click();

		expect(onresetlogs).toHaveBeenCalledOnce();
	});
});
