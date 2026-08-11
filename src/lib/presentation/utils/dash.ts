export interface DashSpec {
	on: number;
	off: number;
}

export const DASH = {
	physical: {
		on: 5,
		off: 3,
	},
	breakEven: {
		on: 7,
		off: 4,
	},
	recommended: {
		on: 5,
		off: 3,
	},
	currentBudget: {
		on: 2,
		off: 3,
	},
} satisfies Record<string, DashSpec>;

export const dashArray = ({ on, off }: DashSpec) => `${on} ${off}`;

export const dashGradient = ({ on, off }: DashSpec, token: string) =>
	`repeating-linear-gradient(90deg, var(${token}) 0 ${on}px, transparent ${on}px ${on + off}px)`;
