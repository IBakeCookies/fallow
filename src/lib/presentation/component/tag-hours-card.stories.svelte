<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within } from 'storybook/test';
	import TagHoursCard from '$lib/presentation/component/tag-hours-card.svelte';
	import { tagHours } from '$lib/business/model/tags';
	import type { DailySession, DrainObservationRecord } from '$lib/business/type';

	const { Story } = defineMeta({
		title: 'Component/Tag Hours Card',
		component: TagHoursCard,
		tags: ['autodocs'],
		args: {
			hasFailed: false,
			locale: 'en-US',
		},
	});

	const RANGE_START = '2026-07-14';

	const day = (tasks: DailySession['tasks']): DailySession => ({
		date: '2026-07-15',
		tasks,
		availableHours: 6,
		switchCost: 0.25,
		updatedAt: 0,
	});

	const drain = (taskId: number, hours: number): DrainObservationRecord => ({
		date: '2026-07-15',
		taskId,
		taskTitle: `task ${taskId}`,
		hours,
		cognitiveDemand: 0.5,
		physicalDemand: 0.3,
		mindDrain: 6,
		bodyDrain: 2,
		createdAt: 0,
	});

	const task = (id: number, tags?: string[]) => ({
		id,
		title: `task ${id}`,
		physicalDifficulty: 3,
		mentalDifficulty: 5,
		enjoyment: 5,
		createdAt: '2026-07-15',
		completed: false,
		...(tags && {
			tags,
		}),
	});

	// Through the real fold rather than a hand-written breakdown, so the card is read on
	// what the store actually hands it.
	const twoTags = tagHours(
		[drain(1, 2), drain(2, 5)],
		[day([task(1, ['exercise']), task(2, ['school'])])],
		RANGE_START,
	);

	const withUntagged = tagHours([drain(1, 3)], [day([task(1)])], RANGE_START);
</script>

<Story
	name="Hours per tag"
	args={{
		breakdown: twoTags,
	}}
	play={async ({ canvas }) => {
		// Each tag's own hours, biggest first: the card answers "where did my week go"
		const rows = canvas.getAllByRole('listitem');

		await expect(within(rows[0]).getByText('school')).toBeInTheDocument();
		await expect(within(rows[0]).getByText('5')).toBeInTheDocument();
		await expect(within(rows[1]).getByText('exercise')).toBeInTheDocument();
		await expect(within(rows[1]).getByText('2')).toBeInTheDocument();
	}}
/>

<Story
	name="Untagged hours are shown"
	args={{
		breakdown: withUntagged,
	}}
	play={async ({ canvas }) => {
		// The untagged row IS the coverage disclosure: hidden, the card would silently
		// disagree with the Logged hours tile above it
		const rows = canvas.getAllByRole('listitem');

		await expect(rows).toHaveLength(1);
		await expect(within(rows[0]).getByText('Untagged')).toBeInTheDocument();
		await expect(within(rows[0]).getByText('3')).toBeInTheDocument();
	}}
/>

<Story
	name="Nothing logged"
	args={{
		breakdown: tagHours([], [], RANGE_START),
	}}
	play={async ({ canvas }) => {
		// A range with no 🪫 sessions says so, rather than showing an empty box
		await expect(canvas.getByText('No hours logged in this range.')).toBeInTheDocument();
	}}
/>
