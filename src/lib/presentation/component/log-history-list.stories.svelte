<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import LogHistoryList from '$lib/presentation/component/log-history-list.svelte';
	import type { LogHistoryRow } from '$lib/presentation/utils/log-history';

	/* Already folded and ordered by `logHistory` — this component only prints. */
	const rows: LogHistoryRow[] = [
		{
			key: 'rest-4',
			id: 4,
			kind: 'rest',
			date: '2026-08-09',
			taskTitle: null,
			hours: 0.5,
			mind: 7,
			mindAfter: 3,
			body: 4,
			bodyAfter: 2,
		},
		{
			key: 'drain-12',
			id: 12,
			kind: 'drain',
			date: '2026-08-09',
			taskTitle: 'writing',
			hours: 1.5,
			mind: 6,
			mindAfter: null,
			body: 2,
			bodyAfter: null,
		},
		{
			key: 'flow-3',
			id: 3,
			kind: 'flow',
			date: '2026-08-08',
			taskTitle: 'boxing',
			hours: 0.4,
			mind: null,
			mindAfter: null,
			body: null,
			bodyAfter: null,
		},
	];

	const ondelete = fn();
	const onedit = fn();
	const oncancel = fn();
	const onsaveflow = fn();
	const onsavedrain = fn();
	const onsaverest = fn();

	const { Story } = defineMeta({
		title: 'Component/Log History List',
		component: LogHistoryList,
		tags: ['autodocs'],
		args: {
			rows,
			allTime: false,
			editingKey: null,
			ondelete,
			onedit,
			oncancel,
			onsaveflow,
			onsavedrain,
			onsaverest,
		},
	});
</script>

<Story
	name="Every kind of measurement"
	play={async ({ canvas }) => {
		const printed = canvas.getAllByRole('listitem');

		await expect(printed).toHaveLength(3);
		await expect(printed[0]).toHaveTextContent('Break');
		await expect(printed[1]).toHaveTextContent('Session rating');
		await expect(printed[2]).toHaveTextContent('Time to flow');

		// The emoji carrying the kind reads as its own name or as nothing at all.
		await expect(canvas.getByText('Session rating')).toHaveClass('sr-only');

		// Why: presentation/AGENTS.md, "One screen lists logs: `/analytics`"
		await expect(
			canvas.getByRole('link', {
				name: /2026-08-09/,
			}),
		).toHaveAttribute('href', '/?date=2026-08-09');

		await expect(
			canvas.getByRole('link', {
				name: /2026-08-08/,
			}),
		).toHaveAttribute('href', '/?date=2026-08-08');

		await expect(canvas.getAllByRole('link')).toHaveLength(2);

		// A break names no task, so the kind fills the name slot — hidden, since the
		// sr-only kind above already says it.
		await expect(canvas.getByText('· Break')).toHaveAttribute('aria-hidden', 'true');

		await expect(printed[1]).toHaveTextContent('writing');
		await expect(printed[1]).toHaveTextContent('1h 30m');
		await expect(printed[1]).toHaveTextContent('M6');
		await expect(printed[1]).toHaveTextContent('B2');
		await expect(printed[0]).toHaveTextContent('M7→3');
		await expect(printed[0]).toHaveTextContent('B4→2');

		// ⚡ measures a moment, not a drain — no rating to print.
		await expect(printed[2]).toHaveTextContent('24m');
		await expect(printed[2]).not.toHaveTextContent('M');
	}}
/>

<Story
	name="Dropping a measurement"
	play={async ({ canvas, userEvent }) => {
		ondelete.mockClear();

		const drop = canvas.getAllByRole('button', {
			name: /^Delete /,
		});

		await expect(drop).toHaveLength(3);

		// Named by day and kind: a reader listing a 40-row list's buttons would otherwise
		// hear the same phrase forty times.
		await expect(drop[1]).toHaveAccessibleName('Delete Session rating logged on 2026-08-09');

		await userEvent.click(drop[1]);

		await expect(ondelete).toHaveBeenCalledWith('drain', 12);
	}}
/>

<Story
	name="Asking to correct"
	play={async ({ canvas, userEvent }) => {
		onedit.mockClear();

		const correct = canvas.getAllByRole('button', {
			name: /^Correct /,
		});

		await expect(correct).toHaveLength(3);
		await expect(correct[0]).toHaveAccessibleName('Correct Break logged on 2026-08-09');

		await userEvent.click(correct[0]);

		// The row's own key, not a kind and id the caller would have to re-join: the
		// same string `editingKey` is compared against, so re-keying the fold cannot
		// silently stop ✎ from opening anything.
		await expect(onedit).toHaveBeenCalledWith('rest-4');
	}}
/>

<Story
	name="Correcting a time to flow"
	args={{
		editingKey: 'flow-3',
	}}
	play={async ({ canvas, userEvent }) => {
		onsaveflow.mockClear();

		// 0.4 h is 24m, which is what the row prints and so what the editor opens on.
		const minutes = canvas.getByPlaceholderText('min');

		await expect(minutes).toHaveValue(24);

		await userEvent.clear(minutes);
		await userEvent.type(minutes, '35');

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(onsaveflow).toHaveBeenCalledExactlyOnceWith(3, 35);
	}}
/>

<!-- Minutes on screen, hours in the payload — the units the α fit reads (MATH.md §8.7).
     No 🗑 in the form: the row's own ✕ is the drop. -->
<Story
	name="Correcting a session rating"
	args={{
		editingKey: 'drain-12',
	}}
	play={async ({ canvas, userEvent }) => {
		onsavedrain.mockClear();

		await expect(canvas.getByPlaceholderText('min')).toHaveValue(90);
		await expect(canvas.getByLabelText('Mind')).toHaveValue(6);
		await expect(canvas.getByLabelText('Body')).toHaveValue(2);

		await expect(
			canvas.queryByRole('button', {
				name: '🗑',
			}),
		).not.toBeInTheDocument();

		await userEvent.clear(canvas.getByLabelText('Mind'));
		await userEvent.type(canvas.getByLabelText('Mind'), '8');

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(onsavedrain).toHaveBeenCalledExactlyOnceWith(12, {
			hours: 1.5,
			mind: 8,
			body: 2,
		});
	}}
/>

<Story
	name="Correcting a break"
	args={{
		editingKey: 'rest-4',
	}}
	play={async ({ canvas, userEvent }) => {
		onsaverest.mockClear();
		oncancel.mockClear();

		const [mindBefore, mindAfter] = canvas.getAllByLabelText('Mind');

		await expect(canvas.getByPlaceholderText('min')).toHaveValue(30);
		await expect(mindBefore).toHaveValue(7);
		await expect(mindAfter).toHaveValue(3);

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✕',
			}),
		);

		await expect(oncancel).toHaveBeenCalledOnce();
		await expect(onsaverest).not.toHaveBeenCalled();
	}}
/>

<Story
	name="Nothing logged in the range"
	args={{
		rows: [],
	}}
	play={async ({ canvas }) => {
		await expect(canvas.queryByRole('list')).not.toBeInTheDocument();
		await expect(canvas.getByText('No measurements logged in this range.')).toBeVisible();
	}}
/>

<Story
	name="Nothing logged at all"
	args={{
		rows: [],
		allTime: true,
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('No measurements logged yet.')).toBeVisible();
	}}
/>
