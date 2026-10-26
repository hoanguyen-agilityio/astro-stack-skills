# Security and best practices in this stack

What the skeleton sets up, how `pnpm test:pages` checks it, and how to change it without
weakening it. A passing gate or a Lighthouse best-practices score is not a security review.

## Response headers: `src/middleware.ts`

Every page response gets `X-Content-Type-Options: nosniff`, a `Referrer-Policy`,
`X-Frame-Options: DENY` and a `Permissions-Policy` that turns off camera, microphone and
geolocation. `test:pages` fails when the first three are missing.

- A page that must be framed by a partner site: change `X-Frame-Options` and the CSP's
  `frame-ancestors` for that route only, after the user agrees.
- `Strict-Transport-Security` belongs on the HTTPS host or CDN, not in local preview. Add it
  there once every subdomain serves HTTPS.

## Content-Security-Policy: `experimental.csp`

`astro.config.mjs` turns on Astro 5's `experimental.csp`. In `astro build` and `astro preview`,
Astro sends a policy with a hash of every script and style it renders, plus the directives in
the config (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
`frame-ancestors 'none'`, …). `astro dev` runs without it, so a CSP problem shows up in
`test:pages`, not in the dev server: it fails on the console error the browser prints.

| Need | Do | Never |
|------|----|-------|
| An inline script that must run before paint (the theme script) | Keep the text in a constant, render it with `set:html`, and add its hash with `Astro.csp.insertScriptHash(...)`, as `BaseLayout` does | `'unsafe-inline'` |
| Any other script | A normal `<script>` in a component (Astro bundles it and hashes it) or an island | An inline `onclick` |
| A third-party script (analytics, chat) | Agree it with the user, add its origin with `experimental.csp.scriptDirective.resources` (or `Astro.csp.insertScriptResource` on the pages that need it), load it after consent, pin it with Subresource Integrity when the vendor publishes a hash, count it in the budget | `'unsafe-eval'`, a wildcard origin |
| Images or fonts from a CDN | Add the origin to `img-src` / `font-src` in the directives | `img-src *` |
| An API on another origin | Add it to `connect-src`, or keep calling `/rpc` on the same origin through the proxy | |

`Astro.csp` throws `CspNotEnabled` where the CSP is off (`astro dev`, the Container API in page
tests, Storybook); `BaseLayout` catches only that error.

## Errors and the console

- `test:pages` fails on any console error and uncaught exception on a page, CSP violations
  included. Requests to `/rpc/` are left out: without a backend behind `astro preview` they
  fail, and the page's error state is tested by the page and island tests.
- An island that can throw while rendering shows an error state instead of disappearing: the
  outcome helpers already turn failures into values; keep exceptions out of render.
- No `console.log` left in shipped code.

## Build output and dependencies

- No source maps in production: Vite's `build.sourcemap` stays off (the default). If an error
  tracker needs them, use `'hidden'` and upload them without serving them.
- `pnpm audit --prod` before a release; a high or critical advisory in a runtime dependency is
  a `blocker`, in a dev-only tool a `should`.
- Never load code from a CDN you do not control (the polyfill.io takeover in 2024); bundle it.

## HTML and browser APIs

- `<!doctype html>`, `<meta charset>` first in `<head>`, a responsive viewport: `BaseLayout`
  has them and `test:pages` checks the last two.
- No duplicate `id`s; an island rendered twice on a page gets ids from `useId()`.
- No `document.write`, no synchronous XHR; `{ passive: true }` on scroll and touch listeners.
- Ask for permissions (location, notifications) only after a user action that needs them, and
  say why first.
