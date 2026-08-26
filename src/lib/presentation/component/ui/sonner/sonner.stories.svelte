<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Toaster from './sonner.svelte';
	import { showToast, TOAST_SEVERITIES } from '$lib/presentation/utils/toast';

	const { Story } = defineMeta({
		title: 'UI/Toaster',
		component: Toaster,
		tags: ['autodocs'],
	});
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';

	// The toaster renders imperatively, so a story has to raise something for the
	// a11y pass to have anything to check.
	onMount(() => {
		for (const severity of TOAST_SEVERITIES) showToast[severity](`A ${severity} message.`);
	});

	// <Story name="Every severity"> — Every severity at once, so the theme toolbar shows all four
	// tints against the same background. Each is the app's callout recipe (fill at 5%, border at 20%,
	// `-strong` ink) rather than a solid fill — a toast carries a sentence, and `-ink` is only for
	// short labels.
	//
	// The long `duration` is load-bearing for the test, not the look: on the default 4s lifetime axe
	// races the auto-dismiss. It must be finite — sonner honours `Infinity` only as a *per-toast*
	// duration (`Toast.svelte`), and a toaster-level `Infinity` reaches `setTimeout` where WebIDL
	// coerces it to 0, dismissing every toast about 200ms after mount. `visibleToasts` is raised
	// because the default of 3 would hide one of the four.
</script>

<Story name="Every severity" asChild>
	<div class="h-96">
		<Toaster
			containerAriaLabel={m.toast_region_label()}
			duration={600_000}
			visibleToasts={4}
			expand
		/>
	</div>
</Story>
