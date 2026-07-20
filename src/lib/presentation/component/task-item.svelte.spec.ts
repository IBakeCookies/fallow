import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TaskItem from './task-item.svelte';

const baseProps = {
	id: 1,
	title: 'boxing',
	physicalDifficulty: 5,
	mentalDifficulty: 5,
	enjoyment: 7,
	completed: false,
	priorityScore: 42,
	suggestedHours: 1.5,
	trueEffort: 6.2,
	flowStateTime: 0.5,
	optimalStopHours: 2,
	ontoggle: vi.fn(),
	onremove: vi.fn()
};

describe('task-item.svelte', () => {
	it('renders title, inputs, allocation, and derived values', async () => {
		render(TaskItem, { ...baseProps, runOrder: 1 });

		await expect.element(page.getByRole('heading', { name: 'boxing' })).toBeInTheDocument();
		await expect.element(page.getByText('#1')).toBeInTheDocument();
		await expect.element(page.getByText('P 5')).toBeInTheDocument();
		await expect.element(page.getByText('M 5')).toBeInTheDocument();
		await expect.element(page.getByText('E 7')).toBeInTheDocument();
		await expect.element(page.getByText('1h 30m', { exact: true })).toBeInTheDocument();
		await expect.element(page.getByText('prio 42')).toBeInTheDocument();
		await expect
			.element(page.getByText('effort 6.2 · flow @ 30m · stop by 2h'))
			.toBeInTheDocument();
	});

	it.each([
		[9, 2, 'COG'],
		[2, 9, 'PHY'],
		[5, 5, 'HYB']
	])('mental %s / physical %s shows nature badge %s', async (mental, physical, label) => {
		render(TaskItem, { ...baseProps, mentalDifficulty: mental, physicalDifficulty: physical });

		await expect.element(page.getByText(label, { exact: true })).toBeInTheDocument();
	});

	it('completed tasks strike through and hide allocation and run order', async () => {
		render(TaskItem, { ...baseProps, completed: true, runOrder: 1 });

		await expect.element(page.getByRole('checkbox')).toBeChecked();
		await expect.element(page.getByRole('heading', { name: 'boxing' })).toHaveClass(/line-through/);
		expect(page.getByText('#1').elements()).toHaveLength(0);
		expect(page.getByText('prio 42').elements()).toHaveLength(0);
	});

	it('toggles and removes via their controls', async () => {
		const ontoggle = vi.fn();
		const onremove = vi.fn();
		render(TaskItem, { ...baseProps, ontoggle, onremove });

		await page.getByRole('checkbox').click();
		expect(ontoggle).toHaveBeenCalledExactlyOnceWith(1);

		await page.getByRole('button', { name: 'Delete task' }).click();
		expect(onremove).toHaveBeenCalledExactlyOnceWith(1);
	});

	it('logs time-to-flow in minutes', async () => {
		const onlogflow = vi.fn();
		render(TaskItem, { ...baseProps, onlogflow });

		await page.getByRole('button', { name: 'Log time to flow' }).click();
		await page.getByPlaceholder('min').fill('25');
		await page.getByRole('button', { name: '✓' }).click();

		expect(onlogflow).toHaveBeenCalledExactlyOnceWith(1, 25);
	});

	it('rejects a flow log without minutes', async () => {
		const onlogflow = vi.fn();
		render(TaskItem, { ...baseProps, onlogflow });

		await page.getByRole('button', { name: 'Log time to flow' }).click();
		await page.getByRole('button', { name: '✓' }).click();

		expect(onlogflow).not.toHaveBeenCalled();
	});

	it('edits title and sliders through the inline editor', async () => {
		const onupdate = vi.fn();
		render(TaskItem, { ...baseProps, onupdate });

		await page.getByRole('button', { name: 'Edit task' }).click();
		const title = page.getByLabelText('Title');
		await expect.element(title).toHaveValue('boxing');
		await title.fill('sparring');
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onupdate).toHaveBeenCalledExactlyOnceWith(1, {
			title: 'sparring',
			physicalDifficulty: 5,
			mentalDifficulty: 5,
			enjoyment: 7
		});
	});

	it('shows the measured flow badge when present', async () => {
		render(TaskItem, { ...baseProps, flowMinutes: 25, onlogflow: vi.fn() });

		await expect.element(page.getByText('⚡ 25m')).toBeInTheDocument();
	});
});
