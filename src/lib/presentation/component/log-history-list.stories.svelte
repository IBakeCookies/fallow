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

<!-- The analytics range's measurements in one list. Three kinds share one row shape:
     the day and what was measured on the left, the reading on the right. The play
     checks that the print order is the fold's, that the emoji is not the only thing
     saying which kind a row is, and that ☕ names no task. -->
<Story
	name="Every kind of measurement"
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

		// The day a task's measurement belongs to is a link to that day. Navigation, not
		// the correction path — the ✎ below corrects in place — so it promises only to
		// open the day. ☕ belongs to no day's row, so its date is a date.
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
	play={async ({ canvas, userEvent }) => {
		ondelete.mockClear();

		const drop = canvas.getAllByRole('button', {
			name: /^Delete /,
		});

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

<!-- The ✎ opens a correction on the row itself. Every kind has one — ☕ included, which
     is the only editor a break has, since it belongs to no task's row (MATH.md §36). The
     list only asks; which row is open is the page's, because the page owns the stores the
     save lands in. -->
<Story
	name="Asking to correct"
	play={async ({ canvas, userEvent }) => {
		onedit.mockClear();

		const correct = canvas.getAllByRole('button', {
			name: /^Correct /,
		});

		await expect(correct).toHaveLength(3);
		await expect(correct[0]).toHaveAccessibleName('Correct Break logged on 2026-08-09');

		// Both verbs travel with the kind: three stores autoincrement independently, so
		// "4" alone names a different record in each.
		await userEvent.click(correct[0]);

		await expect(onedit).toHaveBeenCalledWith('rest', 4);
	}}
/>

<!-- ⚡'s correction is one number, seeded with the reading the row prints — the same
     editor the badge on a task's row opens, and the same conversion: minutes on screen,
     hours in the fit. -->
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

<!-- 🪫's is three, and it saves in the units the α fit reads (MATH.md §8.7): hours, and
     the two 0–10 ratings. No 🗑 in the form — the row's own ✕ is the drop, and two of
     them on one row would be R3's mirrors case. -->
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

<!-- ☕'s is five, and both sides of the pair are seeded: the row prints M7→3, so the
     editor opens on 7 and 3. -->
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

		// ✕ closes without saving — the page is what holds the open row, so the form can
		// only ask to be closed.
		await userEvent.click(
			canvas.getByRole('button', {
				name: '✕',
			}),
		);

		await expect(oncancel).toHaveBeenCalledOnce();
		await expect(onsaverest).not.toHaveBeenCalled();
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

<!-- With the range dropped, an empty list is the other claim: nothing was ever logged.
     Worth distinguishing because "all time" is what a user reaches for to find the old
     row they came to fix, and "none in this range" would read as the range still biting. -->
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
