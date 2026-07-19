// The tag is assembled from fragments because Svelte refuses a literal
// "<script" inside component script blocks; "<" in the payload is escaped so
// message strings can never terminate the inline script element.
export function jsonLdScript(data: Record<string, unknown>): string {
	return (
		'<scr' +
		'ipt type="application/ld+json">' +
		JSON.stringify(data).replace(/</g, '\\u003c') +
		'</scr' +
		'ipt>'
	);
}
