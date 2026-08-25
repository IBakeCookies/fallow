<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, fn } from 'storybook/test';
	import RestLogForm from '$lib/presentation/component/rest-log-form.svelte';

	const { Story } = defineMeta({
		title: 'Component/Rest Log Form',
		component: RestLogForm,
		tags: ['autodocs'],
	});
</script>

<!-- The ☕ editor, as it appears inside the recovery calibration card: minutes rested
     and both capacities rated before and after. Every field is required — a blank
     "after" would enter the §8.9 fit as a break that left you at zero. The play walks
     the policy: the caret starts in the length field, ✕ discards without reporting,
     no length and blank afters both refuse, and minutes report as hours. -->
<Story
	name="Open"
	args={{
		onsave: fn(),
		oncancel: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		const minutes = canvas.getByPlaceholderText('min');
		// "before"/"after" is visual grouping, not accessible grouping, so both Mind
		// fields answer to the same name — first is before, second after
		const [mindBefore, mindAfter] = canvas.getAllByLabelText('Mind');
		const [bodyBefore, bodyAfter] = canvas.getAllByLabelText('Body');

		const save = canvas.getByRole('button', {
			name: '✓',
		});

		// The ☕ button is the only way in, so the caret is always asked for
		await expect(minutes).toHaveFocus();

		// ✕ discards the draft without reporting it
		await userEvent.type(minutes, '30');

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✕',
			}),
		);

		await expect(args.oncancel).toHaveBeenCalledOnce();
		await expect(args.onsave).not.toHaveBeenCalled();

		// A break of no length is not a break
		await userEvent.clear(minutes);
		await userEvent.type(mindBefore, '8');
		await userEvent.type(mindAfter, '3');
		await userEvent.type(bodyBefore, '6');
		await userEvent.type(bodyAfter, '2');
		await userEvent.click(save);
		await expect(args.onsave).not.toHaveBeenCalled();

		// Blank afters refuse — §8.9 would read them as "the break left me at zero"
		await userEvent.type(minutes, '30');
		await userEvent.clear(mindAfter);
		await userEvent.clear(bodyAfter);
		await userEvent.click(save);
		await expect(args.onsave).not.toHaveBeenCalled();

		// Minutes in, hours out: the store and the §8.9 fit both work in hours
		await userEvent.type(mindAfter, '3');
		await userEvent.type(bodyAfter, '2');
		await userEvent.click(save);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith({
			hours: 0.5,
			mindBefore: 8,
			mindAfter: 3,
			bodyBefore: 6,
			bodyAfter: 2,
		});
	}}
/>

<!-- Correcting a stored break, from the analytics history — ☕ has no task and so no
     row on either screen, which makes that list its only editor. The
     same form seeded; what it saves is the same shape, since a correction rewrites
     exactly the five numbers this asks for. -->
<Story
	name="Correcting a stored break"
	args={{
		seed: {
			minutes: 45,
			mindBefore: 7,
			mindAfter: 4,
			bodyBefore: 5,
			bodyAfter: 1,
		},
		onsave: fn(),
		oncancel: fn(),
	}}
	play={async ({ args, canvas, userEvent }) => {
		const minutes = canvas.getByPlaceholderText('min');
		const [mindBefore, mindAfter] = canvas.getAllByLabelText('Mind');
		const [bodyBefore, bodyAfter] = canvas.getAllByLabelText('Body');

		await expect(minutes).toHaveValue(45);
		await expect(mindBefore).toHaveValue(7);
		await expect(mindAfter).toHaveValue(4);
		await expect(bodyBefore).toHaveValue(5);
		await expect(bodyAfter).toHaveValue(1);

		// A 0 rating survives the seed: `mindAfter: 0` is "the break left me fine", and
		// a form that read it as blank would refuse to save an unedited correction.
		await userEvent.clear(mindAfter);
		await userEvent.type(mindAfter, '0');

		await userEvent.click(
			canvas.getByRole('button', {
				name: '✓',
			}),
		);

		await expect(args.onsave).toHaveBeenCalledExactlyOnceWith({
			hours: 0.75,
			mindBefore: 7,
			mindAfter: 0,
			bodyBefore: 5,
			bodyAfter: 1,
		});
	}}
/>
