/**
 * Domain-free 3×3 linear algebra for the Bayesian constants fit (fitUserConstants).
 * Kept out of zenith.ts because it is generic numerics, not model math.
 */

/**
 * Solve a 3×3 linear system via Gaussian elimination with partial pivoting.
 * Returns null when the system is (near-)singular.
 */
export function solve3x3(A: number[][], y: number[]): number[] | null {
	const m = A.map((row, i) => [...row, y[i]]);
	const scale = Math.max(1, ...A.flat().map(Math.abs));

	for (let col = 0; col < 3; col++) {
		let pivot = col;
		for (let row = col + 1; row < 3; row++) {
			if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
		}
		if (Math.abs(m[pivot][col]) < 1e-9 * scale) return null;
		[m[col], m[pivot]] = [m[pivot], m[col]];

		for (let row = col + 1; row < 3; row++) {
			const factor = m[row][col] / m[col][col];
			for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k];
		}
	}

	const x = [0, 0, 0];
	for (let row = 2; row >= 0; row--) {
		let sum = m[row][3];
		for (let k = row + 1; k < 3; k++) sum -= m[row][k] * x[k];
		x[row] = sum / m[row][row];
	}
	return x;
}

// Inverse of a symmetric positive-definite 3×3 via three solves against the
// identity columns; symmetrized to scrub floating-point asymmetry.
export function invert3x3(A: number[][]): number[][] | null {
	const cols: number[][] = [];
	for (let i = 0; i < 3; i++) {
		const e = [0, 0, 0];
		e[i] = 1;
		const col = solve3x3(A, e);
		if (!col) return null;
		cols.push(col);
	}
	const inv = [
		[cols[0][0], cols[1][0], cols[2][0]],
		[cols[0][1], cols[1][1], cols[2][1]],
		[cols[0][2], cols[1][2], cols[2][2]]
	];
	for (let i = 0; i < 3; i++) {
		for (let j = i + 1; j < 3; j++) {
			const s = (inv[i][j] + inv[j][i]) / 2;
			inv[i][j] = s;
			inv[j][i] = s;
		}
	}
	return inv;
}
