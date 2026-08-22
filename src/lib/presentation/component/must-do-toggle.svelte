<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/presentation/utils';
	import { buttonVariants, type ButtonSize } from '$lib/presentation/component/ui/button';

	interface Props {
		mustDoToday: boolean;
		size?: ButtonSize;
		class?: string;
	}

	let { mustDoToday = $bindable(), size = 'default', class: className }: Props = $props();
</script>

<!-- A button's look on a real checkbox, which is the STYLE.md carve-out from
     `appearance-auto accent-brand`: the input keeps the native control — its accessible
     name, its space key, `.check()` in a test — while the label around it carries the
     button recipe. The input is a transparent overlay rather than `sr-only` because
     Playwright clicks the box it is given: shrunk to a corner, the label intercepts the
     click and `.check()` times out. The focus ring has to be `has-*`, not `peer-*`: the
     input is inside the label, so the two are never siblings. -->
<label
	title={m.form_must_do_today_title()}
	class={cn(
		buttonVariants({
			variant: mustDoToday ? 'secondary' : 'outline',
			size,
		}),
		'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 relative has-[:focus-visible]:ring-3',
		className,
	)}
>
	<input
		type="checkbox"
		bind:checked={mustDoToday}
		class="absolute inset-0 cursor-pointer appearance-none opacity-0"
	/>
	{m.form_must_do_today()}
</label>
