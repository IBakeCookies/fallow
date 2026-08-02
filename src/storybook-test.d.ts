/**
 * `storybook/test`'s `expect` types only extend vitest's `JestAssertion`, but
 * `toHaveBeenCalledExactlyOnceWith` lives on vitest's own `Assertion`
 * interface — storybook hand-patched `toHaveBeenCalledOnce()` (same gap) and
 * missed this one. The matcher exists at runtime (the installed @vitest/expect
 * provides it), so this only teaches the type checker. Returns Promise like
 * every storybook-instrumented matcher. Drop when storybook exposes it.
 */
declare module 'storybook/test' {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- merging requires the target's exact type parameter list
	interface Assertion<T> {
		toHaveBeenCalledExactlyOnceWith<E extends unknown[]>(...args: E): Promise<void>;
	}
}

export {};
