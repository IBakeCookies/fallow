/* Stands in for SvelteKit's $env/dynamic/public inside Storybook — see main.ts.
   Empty, so components fall back to the same defaults they use in production
   with no PUBLIC_* variable set. */
export const env: Record<string, string | undefined> = {};
