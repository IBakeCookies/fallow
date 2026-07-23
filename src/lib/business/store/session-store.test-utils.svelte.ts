/**
 * Test-only reactive stand-in for `$app/state`'s page, so session-store specs
 * can drive date navigation by reassigning `mockPage.url`. Lives in a
 * `.svelte.ts` file because the spec itself is not compiled with runes.
 */
class MockPage {
	url = $state(new URL('http://localhost/'));
}

export const mockPage = new MockPage();
