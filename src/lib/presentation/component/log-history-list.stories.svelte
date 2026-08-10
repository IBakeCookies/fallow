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

	const { Story } = defineMeta({
		title: 'Component/Log History List',
		component: LogHistoryList,
		tags: ['autodocs'],
	});
</script>

<!-- The analytics range's measurements in one list. Three kinds share one row shape:
     the day and what was measured on the left, the reading on the right. The play
     checks that the print order is the fold's, that the emoji is not the only thing
     saying which kind a row is, and that ☕ names no task. -->
<Story
	name="Every kind of measurement"
	args={{
		rows,
		ondelete,
	}}
	play={async ({ canvas }) => {
		const printed = canvas.getAllByRole('listitem');

		// Newest first is the fold's order, printed as given — a component that
		// re-sorts would make `logHistory`'s own test a claim about nothing.
		await expect(printed).toHaveLength(3);
		await expect(printed[0]).toHaveTextContent('Break');
		await expect(printed[1]).toHaveTextContent('Session rating');
		await expect(printed[2]).toHaveTextContent('Time to flow');

		// A merged list is where the kind stops being obvious, and the emoji that
		// carries it visually reads as its own name or nothing at all.
		await expect(canvas.getByText('Session rating')).toHaveClass('sr-only');

		// 🪫 rates a session on one task; ☕ is a break, worked on nothing.
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

<!-- Dropping one bad point. The kind travels with the id because the three kinds are
     three stores: the same number names a different record in each, so a caller told
     only "12" would delete whatever happened to be twelfth somewhere. -->
<Story
	name="Dropping a measurement"
	args={{
		rows,
		ondelete,
	}}
	play={async ({ canvas, userEvent }) => {
		ondelete.mockClear();

		const drop = canvas.getAllByRole('button');

		// Every row is droppable, including ☕ — a mistyped break poisons the recovery
		// fit exactly as a mistyped session poisons the drain one.
		await expect(drop).toHaveLength(3);

		// Named by day and kind, not "delete": a screen reader listing the buttons of a
		// 40-row list would otherwise read the same phrase forty times.
		// The kind is the list's own name for it, interpolated rather than respelled.
		await expect(drop[1]).toHaveAccessibleName('Delete Session rating logged on 2026-08-09');

		await userEvent.click(drop[1]);

		await expect(ondelete).toHaveBeenCalledWith('drain', 12);
	}}
/>

<!-- A range with nothing in it says so. Not the same claim as the page's own empty
     state, which is about a user who has never logged anything. -->
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
