<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import { buildDayTimeline, type DayBlock } from '$lib/presentation/utils/day-timeline';
	import DayTimeline from '$lib/presentation/component/day-timeline.svelte';

	/* Bands are the banding policy's output (utils/band.ts): a block that reaches
	   its time-to-flow is `success`, one the plan stops short of is `warning`. */
	const blocks: DayBlock[] = [
		{
			id: 1,
			title: 'Write the PDF',
			position: 1,
			hours: 1.75,
			startOffset: 0,
			flowHours: 2,
			band: 'warning',
		},
		{
			id: 2,
			title: 'Boxing training',
			position: 2,
			hours: 1.5,
			startOffset: 2,
			flowHours: 1.25,
			band: 'success',
		},
	];

	/* Twelve funded tasks in an 8h day, the shortest of them a 15-minute allocation:
	   through the real view model, because the geometry under test IS its arithmetic. */
	const crowdedHours = [1.25, 1.2, 1, 0.8, 0.6, 0.5, 0.5, 0.4, 0.4, 0.3, 0.25, 0.25];

	const crowdedDay = buildDayTimeline({
		suggestedTasks: crowdedHours.map((suggestedHours, index) => ({
			id: index + 1,
			title: `Expense report ${index + 1}`,
			suggestedHours,
			flowStateTime: 1,
		})),
		runOrder: new Map(crowdedHours.map((_, index): [number, number] => [index + 1, index + 1])),
		switchCost: 0.05,
		availableHours: 8,
	});

	const { Story } = defineMeta({
		title: 'Component/Day Timeline',
		component: DayTimeline,
		tags: ['autodocs'],
		args: {
			totalHours: 8,
			minimumBlockWidths: 8 / 1.5,
			blocks,
		},
	});
</script>

<!-- Colour is the only thing separating the two bands on the strip, so the band
     has to be readable without it (WCAG 1.4.1) -->
<Story
	name="A block short of flow"
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Caution')).toBeInTheDocument();

		// A day that fits is untouched by the floor: the track is the container's own
		// width and each block its share of the day.
		const block = canvas.getByText('Write the PDF').parentElement!;
		const track = block.parentElement!;

		await expect(track.clientWidth).toBe(track.parentElement!.clientWidth);
		await expect(block.getBoundingClientRect().width / track.clientWidth).toBeCloseTo(1.75 / 8, 2);
	}}
/>

<!-- The day the strip exists for. The 15-minute allocation is BY CONSTRUCTION the
     block short of flow, and proportionally it is a colour sliver, so the strip
     carries a floor and scrolls inside its own container — never the document
     (task-list-card.svelte's ledger is the same pattern). -->
<Story
	name="More than fits"
	args={crowdedDay}
	play={async ({ canvas }) => {
		const shortest = canvas.getByText('Expense report 12').parentElement!;
		const longest = canvas.getByText('Expense report 1').parentElement!;
		const track = shortest.parentElement!;
		const strip = track.parentElement!;

		// `#12`, its title and its duration are legible at the floor: 4rem, and
		// `getByText` matched the line, which only holds while the title is a text node
		// of its own.
		await expect(shortest.getBoundingClientRect().width).toBeGreaterThanOrEqual(64);

		// To scale, floor or no floor: 1.25h reads five times the 15-minute block.
		await expect(
			longest.getBoundingClientRect().width / shortest.getBoundingClientRect().width,
		).toBeCloseTo(5, 1);

		// The floor is the width of a block that has dropped its sentence, so the sentence
		// is what the narrowest block trades for its two remaining lines — while the block
		// five times its width keeps it. Both still carry it for a screen reader.
		const sentence = (block: Element) => block.querySelectorAll('p')[2];

		await expect(sentence(longest)).toBeVisible();
		await expect(sentence(longest).getBoundingClientRect().width).toBeGreaterThan(100);
		await expect(sentence(shortest).getBoundingClientRect().width).toBeLessThanOrEqual(1);
		await expect(sentence(shortest).textContent?.trim()).toBe('short of flow by 45m');

		// The bars are the reading blocks are compared on, so they sit on one line across
		// the strip whether or not each block above them kept its sentence.
		const bar = (block: Element) => block.querySelector('.mt-auto')!.getBoundingClientRect();

		await expect(bar(shortest).top).toBeCloseTo(bar(longest).top, 0);

		// The strip is what overflows; the page never scrolls sideways.
		await expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);

		await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
			document.documentElement.clientWidth,
		);

		// And it drags: the scrollbar is thin and hidden until hover, so the strip
		// itself has to be the handle.
		const drag = (type: string, clientX: number) =>
			(type === 'pointerdown' ? strip : window).dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					pointerType: 'mouse',
					button: 0,
					clientX,
				}),
			);

		drag('pointerdown', 200);
		drag('pointermove', 140);

		await expect(strip.scrollLeft).toBe(60);

		// Released, the pointer stops moving the strip — or the next mouse move
		// anywhere on the page keeps dragging it.
		drag('pointerup', 140);
		drag('pointermove', 40);

		await expect(strip.scrollLeft).toBe(60);
	}}
/>

<!-- A day with no funded task still has a start and something to say -->
<Story
	name="Nothing funded"
	args={{
		blocks: [],
	}}
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Nothing is funded today')).toBeInTheDocument();
	}}
/>
