import { type VariantProps, tv } from 'tailwind-variants';

// Class generator for the app's segmented toggle/tab buttons (range picker,
// calendar view switch, nav locale switch, energy plan view). Every toggle
// shares the same active state (bg-surface-hover text-ty-primary); the `tone`
// variant carries the per-instance size and inactive-hover treatment.
export const segmentedToggleVariants = tv({
	variants: {
		tone: {
			segment: 'rounded-md px-3 py-1 text-sm transition-colors',
			nav: 'rounded-lg px-2 py-1.5 text-xs font-medium uppercase transition-colors',
			plan: 'rounded-md px-2.5 py-1 text-xs transition'
		},
		active: {
			true: 'bg-surface-hover text-ty-primary',
			false: ''
		}
	},
	compoundVariants: [
		{ tone: 'segment', active: false, class: 'text-ty-secondary hover:text-ty-primary' },
		{
			tone: 'nav',
			active: false,
			class: 'text-ty-silent hover:bg-surface-card hover:text-ty-secondary'
		},
		{ tone: 'plan', active: false, class: 'text-ty-silent hover:text-ty-secondary' }
	],
	defaultVariants: {
		tone: 'segment'
	}
});

export type SegmentedToggleTone = VariantProps<typeof segmentedToggleVariants>['tone'];
