import { describe, expect, it } from 'vitest';
import { calculateTaskAllocations } from './zenith';

describe('calculateTaskAllocations', () => {
	it('distributes a time budget based on difficulty and enjoyment', () => {
		const allocations = calculateTaskAllocations(
			[
				{ title: 'Write report', difficulty: 4, enjoyment: 2 },
				{ title: 'Practice piano', difficulty: 2, enjoyment: 8 }
			],
			6
		);

		expect(allocations).toHaveLength(2);
		expect(allocations[0].allocatedHours + allocations[1].allocatedHours).toBeCloseTo(6, 1);
		expect(allocations[1].allocatedHours).toBeGreaterThan(allocations[0].allocatedHours);
	});
});
