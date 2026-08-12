import { type VariantProps, tv } from 'tailwind-variants';

// Class generator for the app's segmented toggle/tab buttons (range picker,
// calendar view switch, energy plan view). Every toggle shares the same active
// state (bg-surface-hover text-ty-primary); the `tone` variant carries the
// per-instance size and inactive-hover treatment.
export const segmentedToggleVariants = tv({
	variants: {
		tone: {
			segment: 'rounded-md px-3 py-1 text-sm transition-colors',
			plan: 'rounded-md px-2.5 py-1 text-xs transition',
		},
		active: {
			true: 'bg-surface-hover text-ty-primary',
			false: '',
		},
	},
	compoundVariants: [
		{
			tone: 'segment',
			active: false,
			class: 'text-ty-secondary hover:text-ty-primary',
		},
		{
			tone: 'plan',
			active: false,
			class: 'text-ty-silent hover:text-ty-secondary',
		},
	],
	defaultVariants: {
		tone: 'segment',
	},
});

/**
 * The strip the buttons sit in. Its surface is per-tone and not decoration: a
 * toggle sitting on the page needs `backdrop-blur` (STYLE.md — `surface-card`
 * carries alpha in most themes), while the `plan` one is nested inside an
 * already-blurred card, where a second blur is a no-op over a fill that has to be
 * a step off the card rather than the same `surface-card` again.
 */
export const segmentedToggleGroupVariants = tv({
	base: 'rounded-lg border p-text-3xs',
	variants: {
		tone: {
			segment: 'inline-flex items-center bg-surface-card backdrop-blur',
			plan: 'flex bg-surface-page/40',
		},
	},
	defaultVariants: {
		tone: 'segment',
	},
});

export type SegmentedToggleTone = VariantProps<typeof segmentedToggleVariants>['tone'];
