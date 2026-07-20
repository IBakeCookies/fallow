<script lang="ts">
	interface Props {
		value: number;
		onchange: (value: number) => void;
		min?: number;
		max?: number;
		step?: number;
		unit?: string; // small suffix label inside the field, e.g. "hrs"
		id?: string;
		// Focus accent, passed as a literal class so Tailwind can see it,
		// e.g. "focus-within:border-brand/50"
		accent?: string;
	}

	let {
		value,
		onchange,
		min,
		max,
		step = 1,
		unit,
		id,
		accent = 'focus-within:border-brand/50'
	}: Props = $props();

	// Decimal places of the step, so 0.25-stepping never shows 0.35000000000000003
	const stepDecimals = $derived((String(step).split('.')[1] ?? '').length);

	function clamp(v: number): number {
		if (min !== undefined && v < min) return min;
		if (max !== undefined && v > max) return max;
		return v;
	}

	function stepBy(direction: 1 | -1) {
		const next = clamp((Number(value) || 0) + direction * step);
		onchange(Number(next.toFixed(stepDecimals)));
	}

	function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
		// Don't clamp mid-typing (it fights the user); clamp on blur/steppers.
		const n = e.currentTarget.valueAsNumber;
		if (Number.isFinite(n)) onchange(n);
	}

	function handleBlur(e: FocusEvent & { currentTarget: HTMLInputElement }) {
		const n = e.currentTarget.valueAsNumber;
		onchange(Number.isFinite(n) ? clamp(n) : (min ?? 0));
	}

	const atMin = $derived(min !== undefined && value <= min);
	const atMax = $derived(max !== undefined && value >= max);
</script>

<div
	class="flex items-stretch rounded-lg border border-line-strong bg-input transition-colors {accent}"
>
	<button
		type="button"
		tabindex={-1}
		aria-label="Decrease"
		disabled={atMin}
		onclick={() => stepBy(-1)}
		class="rounded-l-lg px-2.5 text-sm text-ty-silent transition select-none hover:bg-surface-card hover:text-ty-primary disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ty-silent"
	>
		−
	</button>
	<div class="relative min-w-0 flex-1">
		<input
			{id}
			type="number"
			{min}
			{max}
			{step}
			{value}
			oninput={handleInput}
			onblur={handleBlur}
			class="w-full border-0 bg-transparent py-2 pr-9 pl-1 text-center text-sm text-ty-primary outline-none focus:ring-0"
		/>
		{#if unit}
			<span
				class="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-2xs font-medium tracking-wide text-ty-silent uppercase"
			>
				{unit}
			</span>
		{/if}
	</div>
	<button
		type="button"
		tabindex={-1}
		aria-label="Increase"
		disabled={atMax}
		onclick={() => stepBy(1)}
		class="rounded-r-lg px-2.5 text-sm text-ty-silent transition select-none hover:bg-surface-card hover:text-ty-primary disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ty-silent"
	>
		+
	</button>
</div>
