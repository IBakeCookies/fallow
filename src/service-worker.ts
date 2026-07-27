/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `fallow-${version}`;
// '/' is the app shell — all data is client-side, so any route renders from it offline
const ASSETS = [...build, ...files, '/'];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== sw.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// build/static assets are immutable per version — cache first.
			// '/' is deliberately excluded: pages are network-first so SSR
			// (theme cookie, lang) stays live; the cached shell is offline fallback only.
			if (build.includes(url.pathname) || files.includes(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			// pages: network first, fall back to last cached copy when offline.
			// Keyed on the pathname alone: the viewed day rides in a query param,
			// so keying on the full URL would add a permanent entry per day ever
			// visited — the cache has to stay bounded by the number of routes.
			const cacheKey = url.pathname;

			try {
				const response = await fetch(event.request);
				// awaited: an unhandled rejection here (quota) would be silent.
				// Storing the fallback is best-effort — the live response still wins.
				if (response.ok) {
					try {
						await cache.put(cacheKey, response.clone());
					} catch {
						/* storage full or response not storable */
					}
				}
				return response;
			} catch (error) {
				const cached = await cache.match(cacheKey);
				if (cached) return cached;
				if (event.request.mode === 'navigate') {
					const shell = await cache.match('/');
					if (shell) return shell;
				}
				throw error;
			}
		})()
	);
});
