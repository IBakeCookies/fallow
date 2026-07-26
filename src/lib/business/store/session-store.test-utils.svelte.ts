/**
 * Test-only reactive URL the harness reads the date param out of, so specs can
 * drive date navigation by reassigning `mockPage.url`. Lives in a `.svelte.ts`
 * file because the spec itself is not compiled with runes.
 */
class MockPage {
	url = $state(new URL('http://localhost/'));
}

export const mockPage = new MockPage();
