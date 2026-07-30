import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TaskItem from '$lib/presentation/component/task-item.svelte';

const baseProps = {
	id: 1,
	title: 'boxing',
	physicalDifficulty: 5,
	mentalDifficulty: 5,
	enjoyment: 7,
	nature: 'balanced' as const,
	completed: false,
	priorityScore: 42,
	suggestedHours: 1.5,
	trueEffort: 6.2,
	flowStateTime: 0.5,
	optimalStopHours: 2,
	ontoggle: vi.fn(),
	onremove: vi.fn(),
};

describe('task-item.svelte', () => {
	it('renders title, inputs, allocation, and derived values', async () => {
		render(TaskItem, {
			...baseProps,
			runOrder: 1,
		});

		await expect
			.element(
				page.getByRole('heading', {
					name: 'boxing',
				}),
			)
			.toBeInTheDocument();

		await expect.element(page.getByText('#1')).toBeInTheDocument();
		await expect.element(page.getByText('P 5')).toBeInTheDocument();
		await expect.element(page.getByText('M 5')).toBeInTheDocument();
		await expect.element(page.getByText('E 7')).toBeInTheDocument();

		await expect
			.element(
				page.getByText('1h 30m', {
					exact: true,
				}),
			)
			.toBeInTheDocument();

		await expect.element(page.getByText('prio 42')).toBeInTheDocument();

		await expect
			.element(page.getByText('effort 6.2 · flow @ 30m · stop by 2h'))
			.toBeInTheDocument();
	});

	// The classification itself is the model's (getTaskNature); the badge only
	// has to label whichever nature it was handed.
	it.each([
		['cognitive', 'COG'],
		['physical', 'PHY'],
		['balanced', 'HYB'],
	] as const)('nature %s shows badge %s', async (nature, label) => {
		render(TaskItem, {
			...baseProps,
			nature,
		});

		await expect
			.element(
				page.getByText(label, {
					exact: true,
				}),
			)
			.toBeInTheDocument();
	});

	it('names the completion checkbox after the task', async () => {
		render(TaskItem, baseProps);

		await expect
			.element(
				page.getByRole('checkbox', {
					name: 'Mark boxing complete',
				}),
			)
			.toBeInTheDocument();
	});

	it('names every editor slider', async () => {
		render(TaskItem, {
			...baseProps,
			onupdate: vi.fn(),
		});

		await page
			.getByRole('button', {
				name: 'Edit task',
			})
			.click();

		await expect
			.element(
				page.getByRole('slider', {
					name: /Physical Diff/,
				}),
			)
			.toBeInTheDocument();

		await expect
			.element(
				page.getByRole('slider', {
					name: /Mental Diff/,
				}),
			)
			.toBeInTheDocument();

		await expect
			.element(
				page.getByRole('slider', {
					name: /Enjoyment/,
				}),
			)
			.toBeInTheDocument();
	});

	it('completed tasks strike through and hide allocation and run order', async () => {
		render(TaskItem, {
			...baseProps,
			completed: true,
			runOrder: 1,
		});

		await expect.element(page.getByRole('checkbox')).toBeChecked();

		await expect
			.element(
				page.getByRole('heading', {
					name: 'boxing',
				}),
			)
			.toHaveClass(/line-through/);

		expect(page.getByText('#1').elements()).toHaveLength(0);
		expect(page.getByText('prio 42').elements()).toHaveLength(0);
	});

	it('toggles and removes via their controls', async () => {
		const ontoggle = vi.fn();
		const onremove = vi.fn();

		render(TaskItem, {
			...baseProps,
			ontoggle,
			onremove,
		});

		await page.getByRole('checkbox').click();
		expect(ontoggle).toHaveBeenCalledExactlyOnceWith(1);

		await page
			.getByRole('button', {
				name: 'Delete task',
			})
			.click();

		expect(onremove).toHaveBeenCalledExactlyOnceWith(1);
	});

	it('logs time-to-flow in minutes', async () => {
		const onlogflow = vi.fn();

		render(TaskItem, {
			...baseProps,
			onlogflow,
		});

		await page
			.getByRole('button', {
				name: 'Log time to flow',
			})
			.click();

		// The button asked for the editor, so it gets the caret — unlike the
		// completion prompt below
		const minutes = page.getByPlaceholder('min');
		expect(document.activeElement).toBe(minutes.element());

		await minutes.fill('25');

		await page
			.getByRole('button', {
				name: '✓',
			})
			.click();

		expect(onlogflow).toHaveBeenCalledExactlyOnceWith(1, 25);
	});

	it('rejects a flow log without minutes', async () => {
		const onlogflow = vi.fn();

		render(TaskItem, {
			...baseProps,
			onlogflow,
		});

		await page
			.getByRole('button', {
				name: 'Log time to flow',
			})
			.click();

		await page
			.getByRole('button', {
				name: '✓',
			})
			.click();

		expect(onlogflow).not.toHaveBeenCalled();
	});

	it('edits title and sliders through the inline editor', async () => {
		const onupdate = vi.fn();

		render(TaskItem, {
			...baseProps,
			onupdate,
		});

		await page
			.getByRole('button', {
				name: 'Edit task',
			})
			.click();

		const title = page.getByLabelText('Title');
		await expect.element(title).toHaveValue('boxing');
		await title.fill('sparring');

		await page
			.getByRole('button', {
				name: 'Save',
			})
			.click();

		expect(onupdate).toHaveBeenCalledExactlyOnceWith(1, {
			title: 'sparring',
			physicalDifficulty: 5,
			mentalDifficulty: 5,
			enjoyment: 7,
			mustDoToday: false,
		});
	});

	it('badges an unmovable task and lets the editor flag one', async () => {
		const onupdate = vi.fn();

		render(TaskItem, {
			...baseProps,
			mustDoToday: true,
			onupdate,
		});

		await expect.element(page.getByText('Stays today')).toBeInTheDocument();

		await page
			.getByRole('button', {
				name: 'Edit task',
			})
			.click();

		await expect.element(page.getByLabelText("Don't move off today")).toBeChecked();
		await page.getByLabelText("Don't move off today").click();

		await page
			.getByRole('button', {
				name: 'Save',
			})
			.click();

		expect(onupdate).toHaveBeenCalledExactlyOnceWith(1, {
			title: 'boxing',
			physicalDifficulty: 5,
			mentalDifficulty: 5,
			enjoyment: 7,
			mustDoToday: false,
		});
	});

	/* Completing a task is the only ⚡ prompt the user does not have to discover:
	   the button is hover-revealed and its tooltip is the only explanation of the
	   measurement. `completed` is a prop, so the decision reads the value BEFORE
	   the toggle — the parent flips it, not this component. */
	it('asks for time-to-flow when the task is completed', async () => {
		const ontoggle = vi.fn();
		const onlogflow = vi.fn();

		render(TaskItem, {
			...baseProps,
			ontoggle,
			onlogflow,
		});

		const checkbox = page.getByRole('checkbox');
		await checkbox.click();
		expect(ontoggle).toHaveBeenCalledExactlyOnceWith(1);

		// …and opening it must not pull the caret out of the task list. Asserted as
		// "the checkbox still has it", not "the input does not": the attachment runs
		// in an effect, so a focus one tick late satisfies the negative form.
		const minutes = page.getByPlaceholder('min');
		await expect.element(minutes).toBeInTheDocument();
		expect(document.activeElement).toBe(checkbox.element());

		await minutes.fill('25');

		await page
			.getByRole('button', {
				name: '✓',
			})
			.click();

		expect(onlogflow).toHaveBeenCalledExactlyOnceWith(1, 25);
	});

	/* A mis-click is the common case: `completed` is a prop, so the parent flips it
	   back and the prompt has to withdraw the question itself. */
	it('withdraws the prompt when the task is un-completed', async () => {
		let completed = $state(false);

		render(TaskItem, {
			...baseProps,
			get completed() {
				return completed;
			},
			ontoggle: () => (completed = !completed),
			onlogflow: vi.fn(),
		});

		const checkbox = page.getByRole('checkbox');

		await checkbox.click();
		await expect.element(page.getByPlaceholder('min')).toBeInTheDocument();

		await checkbox.click();
		expect(page.getByPlaceholder('min').elements()).toHaveLength(0);
	});

	// …but an editor the user opened by hand is theirs, mid-edit value included
	it('keeps a hand-opened editor across a completion toggle', async () => {
		let completed = $state(false);

		render(TaskItem, {
			...baseProps,
			get completed() {
				return completed;
			},
			ontoggle: () => (completed = !completed),
			onlogflow: vi.fn(),
		});

		await page
			.getByRole('button', {
				name: 'Log time to flow',
			})
			.click();

		await page.getByPlaceholder('min').fill('25');

		const checkbox = page.getByRole('checkbox');
		await checkbox.click();
		await checkbox.click();

		await expect.element(page.getByPlaceholder('min')).toHaveValue(25);
	});

	// `openFlowLog` closes the ✎ editor, whose draft is unsaved until Save — so the
	// prompt must not fire over it
	it('does not ask over the open task editor', async () => {
		render(TaskItem, {
			...baseProps,
			onlogflow: vi.fn(),
			onupdate: vi.fn(),
		});

		await page
			.getByRole('button', {
				name: 'Edit task',
			})
			.click();

		await page.getByLabelText('Title').fill('sparring');

		// The open editor carries its own checkbox, so name the completion one
		await page
			.getByRole('checkbox', {
				name: 'Mark boxing complete',
			})
			.click();

		expect(page.getByPlaceholder('min').elements()).toHaveLength(0);
		await expect.element(page.getByLabelText('Title')).toHaveValue('sparring');
	});

	it('does not ask when the task already carries a measurement', async () => {
		render(TaskItem, {
			...baseProps,
			flowMinutes: 25,
			onlogflow: vi.fn(),
		});

		await page.getByRole('checkbox').click();

		expect(page.getByPlaceholder('min').elements()).toHaveLength(0);
	});

	it('does not ask on un-completing, which ends no session', async () => {
		render(TaskItem, {
			...baseProps,
			completed: true,
			onlogflow: vi.fn(),
		});

		await page.getByRole('checkbox').click();

		expect(page.getByPlaceholder('min').elements()).toHaveLength(0);
	});

	it('shows the measured flow badge when present', async () => {
		render(TaskItem, {
			...baseProps,
			flowMinutes: 25,
			onlogflow: vi.fn(),
		});

		await expect.element(page.getByText('⚡ 25m')).toBeInTheDocument();
	});
});
