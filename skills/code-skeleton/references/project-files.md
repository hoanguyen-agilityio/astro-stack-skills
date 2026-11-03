# Skeleton files

Starting contents for every file `code-skeleton` writes. Adapt names, the adapter and versions
to the repo; keep the behavior. If the repo already has one of these files, merge the missing
parts in rather than overwriting it.

| File | Purpose |
|------|---------|
| `package.json`, `.nvmrc`, `pnpm-workspace.yaml` | pinned Node, scripts, allowed build scripts (`esbuild`, `sharp`) |
| `.gitignore` | `node_modules`, `dist`, `.astro`, `.env`, `storybook-static`, `coverage` |
| `tsconfig.json` | `astro/tsconfigs/strictest`, React JSX, `@/*` alias |
| `astro.config.mjs` | React integration, Tailwind Vite plugin, adapter, dev proxy `/rpc` → API |
| `src/styles/global.css` | Tailwind entry; shadcn adds its theme, the starter UI its `brand` token |
| `eslint.config.js` | flat config; bans `any` and `@ts-ignore`, requires a final newline |
| `oxlint.config.ts`, `tools/oxlint/anti-slop/` | anti-slop rules (vendored, MIT): loose `unknown` contracts, unexplained type assertions, widened dictionaries, hand-rolled Effect `_tag` handling |
| `.jscpd.json` | copy-paste detection for `pnpm dup`, used by `review-code` |
| `.prettierrc`, `.prettierignore`, `.editorconfig` | the team's `space` style: single quotes, trailing commas, 80 columns, Astro plugin |
| `.husky/pre-commit`, `.husky/pre-push`, `.lintstagedrc` | ESLint + Prettier on staged files before a commit; typecheck, tests with 80% coverage, story and page checks before a push |
| `vitest.config.ts`, `vitest.setup.ts` | `getViteConfig`, jsdom, jest-dom, v8 coverage with 80% thresholds |
| `.env.example`, `.env`, `src/env.d.ts` | `PUBLIC_API_URL` placeholder, local copy (gitignored), its type |
| `src/libs/orpcClient.ts` | client factory: `RPCLink` to `${PUBLIC_API_URL}/rpc`, auth header; router type starts empty |
| `.storybook/main.ts`, `preview.ts` | `@storybook-astro/framework` + `react()`; `global.css`, theme toggle, a11y, `createOrpcClient` mocked |
| `scripts/check-stories.ts` | `pnpm test:stories`: every story in Chromium, light and dark; fails on a render error, a failing `play` or an a11y violation |
| `src/middleware.ts` | security headers on every page; the CSP itself comes from `experimental.csp` |
| `src/pages/robots.txt.ts`, `src/pages/sitemap.xml.ts` | crawl rules and the sitemap, built from `site` and `siteConfig.nav` |
| `scripts/check-pages.ts` | `pnpm test:pages`: crawls the built site; fails on SEO metadata, security headers, console errors, broken links, images without alt or size, JS/CSS over budget |

`PUBLIC_API_URL` holds the base **without** `/rpc`, even when the user gives
`http://localhost:8787/rpc`: the client appends `/rpc` and the dev proxy forwards it. The router
type stays empty; `integrate-api` adds procedures, batching, decoding, errors and retry.

## `package.json`

Dependencies are added by the `pnpm add` commands of each layer in `setup-layers.md`.

```json
{
  "name": "<project-name>",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.19"
  },
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro check",
    "lint": "eslint . && oxlint",
    "dup": "jscpd",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test:stories": "storybook build --quiet && node scripts/check-stories.ts",
    "test:pages": "astro build && node scripts/check-pages.ts",
    "prepare": "husky"
  }
}
```

`.nvmrc`:

```text
22
```

## `.gitignore`

```text
node_modules/
dist/
.astro/
storybook-static/
coverage/
.env
.env.*
!.env.example
.claude/settings.local.json
.DS_Store
*.log
```

In retrofit mode, add only the lines that are missing.

## `pnpm-workspace.yaml`

Lets exactly the two build scripts Astro needs run. pnpm 11 (verified):

```yaml
allowBuilds:
  esbuild: true
  sharp: true
```

pnpm 10:

```yaml
onlyBuiltDependencies:
  - esbuild
  - sharp
```

## `tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strictest",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "storybook-static", ".claude", "tools/oxlint/anti-slop"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

`strictest` turns on `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Keep them on:
they catch the `undefined` bugs that API data produces.

## `astro.config.mjs`

```js
// @ts-check
import process from 'node:process';

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';

const { PUBLIC_API_URL, PUBLIC_SITE_URL } = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  '',
);

export default defineConfig({
  // Absolute canonical, Open Graph and sitemap URLs. Set PUBLIC_SITE_URL per environment.
  site: PUBLIC_SITE_URL || 'http://localhost:4321',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  // A strict Content-Security-Policy: a hash for every script and style Astro renders, and
  // nothing from another origin. A third-party script is added on purpose (web-quality skill).
  experimental: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Browser islands call same-origin /rpc; the dev server forwards it to the API (no CORS).
      proxy: {
        '/rpc': { target: PUBLIC_API_URL, changeOrigin: true },
      },
    },
  },
});
```

On Tailwind v3 the repo uses the `@astrojs/tailwind` integration instead of the Vite plugin.
In production, put the same `/rpc` forwarding in the host's proxy or in Astro middleware.

`experimental.csp` (Astro ≥ 5.9) applies in `astro build` and `astro preview`, not in
`astro dev`. Astro hashes the scripts and styles it bundles; an `is:inline` script needs its
hash added with `Astro.csp.insertScriptHash`, which `BaseLayout` does for the theme script. A
CSP violation is a console error, so `pnpm test:pages` fails on it. On Astro < 5.9, leave the
`experimental` block out and send the same directives as a `Content-Security-Policy` header from
the middleware, with a hash for each inline script; never fall back to `'unsafe-inline'`.

## `src/styles/global.css`

```css
@import "tailwindcss";
```

`shadcn init` appends its imports and theme variables to this file. Leave them in place. The
starter UI then appends the `brand` token and the `bg-grid` utility
(`references/starter-ui.md`). The layouts (`BaseLayout.astro`, `AppLayout.astro`) are part of
the starter UI too.

## `eslint.config.js`

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig(
  {
    ignores: [
      'dist',
      '.astro',
      'node_modules',
      'storybook-static',
      'coverage',
      // Copies of the skills, and vendored lint rules: checked where they come from.
      '.claude',
      'tools/oxlint/anti-slop',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      'eol-last': 'error',
    },
  },
);
```

`.claude/` holds the skills and hooks `npx … init` copied in (some are TypeScript), and
`tools/oxlint/anti-slop/` is third-party code kept as upstream wrote it: neither is linted,
type-checked or formatted as project code.

`eol-last` makes `pnpm lint` and the pre-commit hook report a missing final newline instead of
Prettier fixing it silently. It is one of ESLint's deprecated formatting rules, still shipped in
ESLint 9; it needs no extra plugin and does not conflict with Prettier, which writes the same
newline.

## Anti-slop: `oxlint.config.ts` and `tools/oxlint/anti-slop/`

ESLint stays the general linter. Oxlint runs only the anti-slop rules
([dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), MIT), which reject the
low-evidence TypeScript generated code tends to contain: `unknown` in function contracts,
`as unknown as T`, assertions without a reason, open dictionaries that hide a known type,
ad hoc `typeof` checks instead of parsing at the boundary, and hand-rolled `_tag` handling where
Effect has `Predicate.isTagged` and `Match`. They read the syntax tree, not types, so they stay
fast (well under a second) and cover the frontmatter of `.astro` files too.

Copy the skill's `assets/anti-slop/` folder to `tools/oxlint/anti-slop/` unchanged (its
`LICENSE` and `UPSTREAM.md` go with it). From then on the project owns its copy.

`oxlint.config.ts`:

```ts
import { defineConfig } from 'oxlint';

// anti-slop (vendored in tools/oxlint/anti-slop, MIT): rules against the loose types and
// hand-rolled Effect code that generated TypeScript tends to contain. ESLint stays the
// general linter; Oxlint runs only these rules.
export default defineConfig({
  categories: { correctness: 'off' },
  ignorePatterns: [
    '.claude/**',
    'tools/oxlint/anti-slop/**',
    'dist/**',
    'storybook-static/**',
    'coverage/**',
    'src/components/ui/**',
    'src/lib/**',
  ],
  jsPlugins: [
    { name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' },
    {
      name: 'anti-slop-effect',
      specifier: './tools/oxlint/anti-slop/effect/index.ts',
    },
  ],
  rules: {
    'anti-slop/no-array-filter-map': 'error',
    'anti-slop/no-reduce-accumulator-copy': 'error',
    'anti-slop/no-chained-type-assertions': 'error',
    'anti-slop/no-conditional-empty-object-spread': 'error',
    'anti-slop/no-known-value-widening': 'error',
    'anti-slop/no-object-parameters': 'error',
    'anti-slop/no-reflect-apply': 'error',
    'anti-slop/no-reflect-get': 'error',
    'anti-slop/no-runtime-typeof': 'error',
    'anti-slop/no-shape-in-symbol-names': 'error',
    'anti-slop/no-unknown-parameters': 'error',
    'anti-slop/no-unknown-returns': 'error',
    'anti-slop/no-unknown-type-aliases': 'error',
    'anti-slop/no-unsafe-dictionary-type': 'error',
    'anti-slop/no-widen-then-assert': 'error',
    'anti-slop/require-safety-comment-for-type-assertion': 'error',
    // Tests mock modules on purpose (vi.mock, sb.mock): page and island tests depend on it.
    'anti-slop/no-module-mocking': 'off',
    // Blank lines are Prettier's business, not a type-safety rule.
    'anti-slop/require-readable-spacing': 'off',
    'anti-slop-effect/no-manual-effect-error-tag': 'error',
    'anti-slop-effect/no-manual-tag-comparison': 'error',
    'anti-slop-effect/no-manual-tagged-construction': 'error',
    'anti-slop-effect/no-service-constructor-imports': 'error',
    'anti-slop-effect/prefer-effect-match': 'error',
    'oxc/no-accumulating-spread': 'error',
  },
  overrides: [
    {
      // Fakes stand in for the API's wire format (unknown until decoded) and for partial
      // clients, matchers are plain objects, and a test asserts on elements it just found.
      files: ['**/__test__/**', '**/*.stories.tsx', 'src/mocks/**'],
      rules: {
        'anti-slop/no-unknown-returns': 'off',
        'anti-slop/no-unknown-parameters': 'off',
        'anti-slop/no-chained-type-assertions': 'off',
        'anti-slop/require-safety-comment-for-type-assertion': 'off',
        'anti-slop-effect/no-manual-tagged-construction': 'off',
      },
    },
  ],
});
```

- `pnpm lint` runs `eslint . && oxlint`; the pre-commit hook and the `lint-on-edit` hook run
  both on each file, so Claude fixes a finding while it writes the code.
- How to satisfy the usual findings:

  | Finding | Fix |
  |---------|-----|
  | `no-known-value-widening` on `const X: Record<string, string> = {…}` | `{…} satisfies Record<string, string>`; a `Map` when the code looks keys up by a runtime value |
  | `require-safety-comment-for-type-assertion` | Parse instead of asserting; when the assertion is right, a `// SAFETY: <why it holds>` line just above it |
  | `no-manual-tag-comparison` (`e._tag === 'X'`, `switch (e._tag)`) | `Predicate.isTagged(e, 'X')`; `Match.valueTags(e, { X: () => …, Y: () => … })` |
  | `no-unknown-returns` on the one place a service receives the raw response | `// oxlint-disable-next-line anti-slop/no-unknown-returns -- <reason>`: that is where `Schema` decodes it. Anywhere else, return the decoded type |
  | `no-runtime-typeof` | Decode the value with `Schema` where it enters, then branch on the domain type |

- A rule turned off for the whole project, or a disable comment without a reason after `--`,
  is weakening a gate. Disable one line, say why.
- `no-module-mocking` and `require-readable-spacing` are off on purpose (see the comments). The
  rules list and their reasons are in `tools/oxlint/anti-slop/UPSTREAM.md` and upstream's README.

## `.jscpd.json`

```json
{
  "path": ["src"],
  "format": ["typescript", "tsx", "markup"],
  "formatsExts": { "markup": ["astro"], "typescript": ["ts"], "tsx": ["tsx"] },
  "ignore": ["**/components/ui/**", "**/lib/**", "**/__test__/**", "**/*.stories.tsx", "**/mocks/**"],
  "minTokens": 50,
  "minLines": 5,
  "exitCode": 1,
  "reporters": ["consoleFull"],
  "gitignore": true
}
```

`pnpm dup` fails on any copied block of 5 lines or more in `src/`. `.astro` files are compared
as `markup`; without `formatsExts` they are skipped. Generated shadcn code, tests, stories and
fixtures repeat on purpose and are left out. The starter UI has no clones, so the first one
`review-code` reports comes from new code.

## `vitest.config.ts` and `vitest.setup.ts`

```ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/__test__/**',
        'src/**/*.stories.tsx',
        'src/components/ui/**',
        'src/lib/**',
        'src/mocks/**',
        'src/types/**',
        'src/env.d.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

Coverage counts the TypeScript and React source, including files no test imports. It leaves
out what is generated (`ui/`, `lib/`), fixtures, Schema-only `types/` and stories. `.astro`
files are not counted: v8 cannot map them, and the page tests (Container API) cover them.
`pnpm test` stays fast; `pnpm test:coverage` enforces the 80% and runs before every push.

```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

`getViteConfig` reuses Astro's Vite setup, so the `@/` alias works in tests with no extra config.

## `.env.example` and `src/env.d.ts`

```bash
# Base URL of the oRPC server (no trailing slash, no /rpc). Copy to .env.
PUBLIC_API_URL=http://localhost:8787
# Public URL of this site (no trailing slash): canonical links, Open Graph and the sitemap.
PUBLIC_SITE_URL=http://localhost:4321
```

```ts
interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string;
  readonly PUBLIC_SITE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

Make sure `.env` and `storybook-static/` (Storybook's build output) are in `.gitignore`.

## `src/libs/orpcClient.ts`

```ts
import { createORPCClient } from '@orpc/client';
import type { Client } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';

/**
 * One remote procedure. The output is `unknown` on purpose: every response is decoded by an
 * Effect Schema in src/services before the app sees it.
 */
export type Procedure<TInput> = Client<
  Record<never, never>,
  TInput,
  unknown,
  Error
>;

/** The procedures this app calls, by namespace. Empty until integrate-api adds the first one. */
export type AppRouterClient = Record<string, never>;

// `| undefined` lets callers pass a token that may be missing (exactOptionalPropertyTypes).
export interface OrpcClientOptions {
  readonly token?: string | undefined;
  readonly baseUrl?: string | undefined;
}

/** Browser calls go through the same-origin /rpc proxy; server calls go to the API directly. */
const resolveBaseUrl = (baseUrl?: string): string => {
  if (baseUrl) return baseUrl;
  if (typeof window !== 'undefined') return window.location.origin;
  return import.meta.env.PUBLIC_API_URL;
};

export const createOrpcClient = ({
  token,
  baseUrl,
}: OrpcClientOptions = {}): AppRouterClient => {
  const link = new RPCLink({
    url: `${resolveBaseUrl(baseUrl)}/rpc`,
    headers: () => (token ? { Authorization: `Bearer ${token}` } : {}),
  });

  return createORPCClient<AppRouterClient>(link);
};
```

`src/libs/__test__/orpcClient.test.ts`. Without it the factory has 0% coverage and the starter
sits at about 83%, too close to the 80% threshold for the first feature:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOrpcClient } from '../orpcClient';
import type { Procedure } from '../orpcClient';

// The router type is empty until integrate-api adds procedures, so the test declares its own.
type TestClient = { readonly ping: Procedure<undefined> };

const stubFetch = () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ json: 'pong' }), {
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const lastRequest = (fetchMock: ReturnType<typeof stubFetch>): Request => {
  const [input, init] = fetchMock.mock.calls.at(-1) ?? [];
  if (input === undefined) throw new Error('fetch was not called');
  return new Request(input, init);
};

describe('createOrpcClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('calls /rpc on the given base URL with the bearer token', async () => {
    const fetchMock = stubFetch();
    const client = createOrpcClient({
      baseUrl: 'http://api.test',
      token: 'secret',
    }) as unknown as TestClient;

    await expect(client.ping(undefined)).resolves.toBe('pong');

    const request = lastRequest(fetchMock);
    expect(request.url).toBe('http://api.test/rpc/ping');
    expect(request.headers.get('authorization')).toBe('Bearer secret');
  });

  it('uses the same-origin /rpc proxy in the browser and sends no token', async () => {
    const fetchMock = stubFetch();
    const client = createOrpcClient() as unknown as TestClient;

    await client.ping(undefined);

    const request = lastRequest(fetchMock);
    expect(request.url).toBe(`${window.location.origin}/rpc/ping`);
    expect(request.headers.has('authorization')).toBe(false);
  });

  it('uses PUBLIC_API_URL on the server', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubEnv('PUBLIC_API_URL', 'http://server.test');
    const fetchMock = stubFetch();
    const client = createOrpcClient() as unknown as TestClient;

    await client.ping(undefined);

    expect(lastRequest(fetchMock).url).toBe('http://server.test/rpc/ping');
  });
});
```

If the server's router or contract type can be imported (a shared package, a monorepo
sibling), use it rather than the hand-written type:
`RouterClient<typeof router>` from `@orpc/server`, or `ContractRouterClient<typeof contract>`
from `@orpc/contract`. Responses still pass through Schema: a server type describes what the
server should send, and does not check what actually arrives.

## Storybook: `.storybook/main.ts` and `.storybook/preview.ts`

One Storybook covers both kinds of component. `@storybook-astro/framework` renders `.astro`
components on the server through Astro's Container API, and its `react()` integration renders
React components in the browser. It reads `astro.config.mjs`, so Tailwind and the `@/` alias work
without extra Vite config. Verified with framework 1.13, Storybook 10.6, Astro 5.18, Vite 6.4,
React 19 and Tailwind 4, in both `storybook dev` and `storybook build`.

`.storybook/main.ts`:

```ts
import type { StorybookConfig } from '@storybook-astro/framework';
import { react } from '@storybook-astro/framework/integrations';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook-astro/framework',
    options: { integrations: [react()] },
  },
};

export default config;
```

`.storybook/preview.ts`:

```ts
import { withThemeByClassName } from '@storybook/addon-themes';
import type { Preview } from '@storybook-astro/framework';
import { sb } from 'storybook/test';

import '../src/styles/global.css';

// Stories never reach a real API: each React story sets what `createOrpcClient` returns.
sb.mock(import('../src/libs/orpcClient.ts'), { spy: true });

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // Fail the a11y panel loudly instead of only listing violations.
    a11y: { test: 'error' },
  },
  // global.css switches tokens on the `.dark` class, same as the app.
  decorators: [
    withThemeByClassName({
      themes: { light: '', dark: 'dark' },
      defaultTheme: 'light',
    }),
  ],
  tags: ['autodocs'],
};

export default preview;
```

- **Every React story sets `parameters: { renderer: 'react' }`** in its meta. The framework
  renders stories with Astro by default, and a React story without it fails with
  `Renderer 'astro' not found`.
- Stories are `<Name>.stories.tsx` inside the component's folder. Astro stories default-import
  `./index.astro`; React stories import from `'.'` and take their types from `@storybook/react`.
- Install by hand (`setup-layers.md`, layer 9). `storybook init` does not recognise Astro, asks questions, and adds
  example stories.
- pnpm warns that the framework wants `vitest@^4`. That peer is for its optional Vitest
  integration; Storybook and the stories work on the skeleton's Vitest 3, and
  `scripts/check-stories.ts` runs them in a browser without it.
- Fixtures shared by stories and tests live in `src/mocks/<resource>.ts`, in the wire format the
  API sends, so stories go through the same Schema decoding as the app.

## Story checks: `scripts/check-stories.ts`

`pnpm test:stories` is the gate for what a person used to check by eye in Storybook. It builds
Storybook, serves `storybook-static/`, and opens every story in Chromium (Playwright) once per
theme. A story fails when it throws while rendering, its `play` function fails, or the a11y
addon reports a violation (`a11y: { test: 'error' }` in `preview.ts`). It exits 1 and prints the
story, the theme and each problem, so Claude can fix it and run the gate again.

```ts
// Opens every story of the built Storybook in Chromium, once per theme, and fails when a story
// does not render, its play function throws, or the a11y addon reports a violation.
// `pnpm test:stories` builds Storybook, then runs this file with Node's type stripping.
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';

const ROOT = 'storybook-static';
// The `theme` global of withThemeByClassName in .storybook/preview.ts.
const THEMES = ['light', 'dark'];
const TIMEOUT_MS = 15_000;
const PAGES = 4;

const TYPES = new Map(
  Object.entries({
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }),
);

interface Entry {
  id: string;
  type: string;
  importPath: string;
  tags?: string[];
}

interface Violation {
  id: string;
  impact: string | null;
  help: string;
  nodes: { target: string[] }[];
}

interface StoryEvent {
  storyId?: string;
  status?: string;
  description?: string;
  message?: string;
  reporters?: { result?: { violations?: Violation[] } }[];
}

type OnEvent = (event: string, payload: StoryEvent | undefined) => void;

declare global {
  interface Window {
    __STORYBOOK_ADDONS_CHANNEL__?: {
      on: (event: string, listener: (payload: StoryEvent) => void) => void;
    };
    storyEvent: OnEvent;
  }
}

const serve = (): Promise<Server> =>
  new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = join(ROOT, normalize(decodeURIComponent(url.pathname)));
      readFile(path)
        .then((body) => {
          const type = TYPES.get(extname(path)) ?? 'application/octet-stream';
          res.writeHead(200, { 'content-type': type });
          res.end(body);
        })
        .catch(() => {
          res.writeHead(404);
          res.end();
        });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

// Runs in the preview before Storybook starts: freezes colours and forwards channel events.
const listen = () => {
  // A theme switch animates colours through `transition-colors`; axe must see the final ones.
  const still = document.createElement('style');
  still.textContent =
    '*, *::before, *::after { transition: none !important; animation: none !important; }';
  document.addEventListener('DOMContentLoaded', () =>
    document.head.append(still),
  );
  const events = [
    'storyFinished',
    'storyErrored',
    'storyThrewException',
    'playFunctionThrewException',
  ];
  const wait = setInterval(() => {
    const channel = window.__STORYBOOK_ADDONS_CHANNEL__;
    if (!channel) return;
    clearInterval(wait);
    for (const event of events) {
      channel.on(event, (payload) => window.storyEvent(event, payload));
    }
  }, 5);
};

const describe = (event: string, payload: StoryEvent | undefined) => {
  if (event !== 'storyFinished') {
    const message = payload?.description ?? payload?.message ?? 'no message';
    return [`${event}: ${message.split('\n')[0]}`];
  }
  const problems: string[] = [];
  for (const reporter of payload?.reporters ?? []) {
    for (const violation of reporter.result?.violations ?? []) {
      const target = violation.nodes[0]?.target.join(' ') ?? '';
      problems.push(
        `a11y ${violation.id} (${violation.impact}): ${violation.help}, ` +
          `${violation.nodes.length} node(s), first: ${target}`,
      );
    }
  }
  if (payload?.status === 'error' && problems.length === 0) {
    problems.push('story finished with status error');
  }
  return problems;
};

// SAFETY: index.json is written by `storybook build` a moment earlier, in this shape.
const index = JSON.parse(await readFile(join(ROOT, 'index.json'), 'utf8')) as {
  entries: Record<string, Entry>;
};
// A story tagged `!test` loses the `test` tag and is skipped, as in Storybook's test runners.
const stories = Object.values(index.entries).filter(
  (entry) => entry.type === 'story' && (entry.tags ?? []).includes('test'),
);
if (stories.length === 0) {
  console.error(`No stories in ${ROOT}/index.json. Run pnpm build-storybook.`);
  process.exit(1);
}

const server = await serve();
// SAFETY: a server listening on a TCP port reports an AddressInfo, never a pipe name.
const { port } = server.address() as AddressInfo;
const browser = await chromium.launch();
const visits = THEMES.flatMap((theme) =>
  stories.map((story) => ({ story, theme })),
);
const failures: { story: Entry; theme: string; problems: string[] }[] = [];

const check = async (
  page: Page,
  setListener: (listener: OnEvent) => void,
  story: Entry,
  theme: string,
) => {
  const problems: string[] = [];
  const finished = new Promise<'done'>((resolve) => {
    setListener((event, payload) => {
      if (payload?.storyId !== undefined && payload.storyId !== story.id)
        return;
      problems.push(...describe(event, payload));
      if (event === 'storyFinished' || event === 'storyErrored')
        resolve('done');
    });
  });
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), TIMEOUT_MS),
  );
  await page.goto(
    `http://127.0.0.1:${port}/iframe.html?id=${story.id}&viewMode=story&globals=theme:${theme}`,
  );
  if ((await Promise.race([finished, timeout])) === 'timeout') {
    problems.push(`did not finish within ${TIMEOUT_MS} ms`);
  }
  return [...new Set(problems)];
};

const worker = async () => {
  const page = await browser.newPage();
  let listener: OnEvent = () => undefined;
  await page.exposeFunction('storyEvent', ((event, payload) =>
    listener(event, payload)) satisfies OnEvent);
  await page.addInitScript(listen);
  for (let visit = visits.shift(); visit; visit = visits.shift()) {
    const { story, theme } = visit;
    const problems = await check(
      page,
      (next) => (listener = next),
      story,
      theme,
    );
    if (problems.length > 0) failures.push({ story, theme, problems });
  }
  await page.close();
};

await Promise.all(Array.from({ length: PAGES }, worker));
await browser.close();
server.close();

for (const { story, theme, problems } of failures) {
  console.error(`✗ ${story.id} [${theme}] ${story.importPath}`);
  for (const problem of problems) console.error(`    ${problem}`);
}
const total = stories.length * THEMES.length;
console.log(
  `${total - failures.length}/${total} story checks passed ` +
    `(${stories.length} stories × ${THEMES.join(', ')})`,
);
process.exit(failures.length > 0 ? 1 : 0);
```

- Node ≥ 22.18 runs `.ts` files directly (type stripping), so the script needs no build step and
  goes through `pnpm lint` and `pnpm typecheck` like the rest of the code. Keep it to syntax Node
  can strip: no `enum`, no `namespace`, no parameter properties.
- It reads the results of the a11y addon that is already installed, so a rule turned off for one
  story in `parameters.a11y` is off here too, and the Accessibility panel shows the same
  violations. Disabling a rule to get green is weakening a gate: fix the markup or the token.
- Transitions and animations are switched off before axe runs. Without that, the dark theme is
  checked while `transition-colors` is still fading from the light colours, and the contrast
  results are wrong.
- A story tagged `!test` is skipped. Use it only for a story that cannot render on its own, and
  say why in a comment.
- `playwright` brings no browser. Run `pnpm exec playwright install chromium` once per machine
  (`--with-deps` on a bare Linux or CI image). Without it the script stops with
  `Executable doesn't exist`.
- About 20 seconds for 20 stories, most of it the Storybook build. It runs before every push,
  not on every save.

## Security headers, robots and sitemap

`src/middleware.ts`:

```ts
import { defineMiddleware } from 'astro:middleware';

// Headers every page response gets. The Content-Security-Policy itself is the <meta> that
// `experimental.csp` in astro.config.mjs writes, with a hash of each script and style.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // A <meta> CSP cannot set frame-ancestors, so framing is refused here.
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} satisfies Record<string, string>;

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
});
```

`src/pages/robots.txt.ts`:

```ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site, url }) => {
  const sitemap = new URL('/sitemap.xml', site ?? url);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
```

`src/pages/sitemap.xml.ts`:

```ts
import type { APIRoute } from 'astro';

import { siteConfig } from '@/config/site';

// The public pages are the ones in the navigation; add others here if they should be indexed.
export const GET: APIRoute = ({ site, url }) => {
  const entries = siteConfig.nav
    .map(
      ({ href }) =>
        `  <url><loc>${new URL(href, site ?? url).href}</loc></url>`,
    )
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
```

- The headers apply to page responses; `/_astro/` files are served by the adapter with
  `Cache-Control: public, max-age=31536000, immutable` already.
- A public page outside the navigation is added to the sitemap by hand; a `noindex` page never.

## Page checks: `scripts/check-pages.ts`

`pnpm test:pages` is the gate for what a person used to check in DevTools and Lighthouse. It
builds the site, starts `astro preview` on a free port, crawls every page linked from `/` and
listed in the sitemap (up to 50), and fails on: `robots.txt` without a `Sitemap` line; a page
that does not answer 200; a missing `lang`, viewport, title, description, canonical or `<h1>`;
`<meta charset>` not first; no CSP; a missing `X-Content-Type-Options`, `Referrer-Policy` or
`X-Frame-Options`; a console error or uncaught exception (CSP violations included); a
same-origin request that answers 4xx/5xx; a request to another origin over `http:`; an image
without `alt`, `width` or `height`; JavaScript or CSS over the budget; the same title or
description on two indexable pages; a `noindex` page in the sitemap; and a missing page that
does not answer 404 with `noindex`. Each problem names the page, and a broken link names the
page that links to it.

```ts
// Starts the built site with `astro preview`, crawls every page reachable from `/` and the
// sitemap, and fails on what a person would otherwise check by hand in DevTools: missing or
// duplicate SEO metadata, console errors, broken links, missing security headers, images
// without alt or size, and JavaScript or CSS over the budget.
// `pnpm test:pages` builds the site first, then runs this file with Node's type stripping.
import { spawn } from 'node:child_process';
import { createServer, type AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
import { chromium, type Page, type Response } from 'playwright';

// Compressed budgets per page; the same numbers are in DESIGN.md (Performance budget).
const BUDGET_KB = { js: 300, css: 100 };
const MAX_PAGES = 50;
const START_TIMEOUT_MS = 30_000;
// API calls: with no backend behind `astro preview` they fail, and the page shows its error
// state. Their failures belong to the service tests, not to this gate.
const IGNORED_PATHS = ['/rpc/'];
const SECURITY_HEADERS = {
  'x-content-type-options': (value) => value === 'nosniff',
  'referrer-policy': (value) => value.length > 0,
  'x-frame-options': (value) => /deny|sameorigin/i.test(value),
} satisfies Record<string, (value: string) => boolean>;

interface Head {
  lang: string;
  charsetFirst: boolean;
  viewport: boolean;
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
  csp: boolean;
  h1: number;
  imagesWithoutAlt: string[];
  imagesWithoutSize: string[];
  links: string[];
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      // SAFETY: a server listening on a TCP port reports an AddressInfo, never a pipe name.
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });

const port = await freePort();
const origin = `http://127.0.0.1:${port}`;
const preview = spawn(
  'node_modules/.bin/astro',
  ['preview', '--host', '127.0.0.1', '--port', String(port)],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
let previewOutput = '';
preview.stdout.on(
  'data',
  (chunk: Buffer) => (previewOutput += chunk.toString()),
);
preview.stderr.on(
  'data',
  (chunk: Buffer) => (previewOutput += chunk.toString()),
);

const stop = (code: number) => {
  preview.kill();
  process.exit(code);
};

const waitForServer = async () => {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(origin);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  console.error(
    `astro preview did not start on ${origin}. Run pnpm build first.\n${previewOutput}`,
  );
  stop(1);
};
await waitForServer();

const problems: string[] = [];
const fail = (where: string, problem: string) =>
  problems.push(`${where}: ${problem}`);

// robots.txt and the sitemap, whose pages seed the crawl.
const robots = await fetch(`${origin}/robots.txt`);
if (!robots.ok) fail('/robots.txt', `status ${robots.status}`);
else if (!/^Sitemap:\s*\S+/im.test(await robots.text()))
  fail('/robots.txt', 'no Sitemap line');

const sitemapPaths: string[] = [];
const sitemap = await fetch(`${origin}/sitemap.xml`);
if (!sitemap.ok) fail('/sitemap.xml', `status ${sitemap.status}`);
else {
  for (const [, loc] of (await sitemap.text()).matchAll(
    /<loc>([^<]+)<\/loc>/g,
  )) {
    if (loc) sitemapPaths.push(new URL(loc).pathname);
  }
  if (sitemapPaths.length === 0) fail('/sitemap.xml', 'lists no page');
}

const browser = await chromium.launch();
// Each page to visit, with where its link was found.
const queue = [...new Set(['/', ...sitemapPaths])].map((path) => ({
  path,
  from: path === '/' ? 'start' : '/sitemap.xml',
}));
const seen = new Set(queue.map(({ path }) => path));
const heads = new Map<string, Head>();

const readHead = (page: Page) =>
  page.evaluate((): Head => {
    const meta = (selector: string) =>
      document.querySelector<HTMLMetaElement>(selector)?.content.trim() ?? '';
    const images = [...document.images];
    const name = (image: HTMLImageElement) => image.currentSrc || image.src;
    return {
      lang: document.documentElement.lang,
      charsetFirst:
        document.head.firstElementChild?.matches('meta[charset]') ?? false,
      viewport: meta('meta[name="viewport"]').includes('width=device-width'),
      title: document.title.trim(),
      description: meta('meta[name="description"]'),
      canonical:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
          ?.href ?? '',
      noindex: /noindex/i.test(meta('meta[name="robots"]')),
      csp:
        document.querySelector(
          'meta[http-equiv="content-security-policy" i]',
        ) !== null,
      h1: document.querySelectorAll('h1').length,
      imagesWithoutAlt: images.flatMap((image) =>
        image.hasAttribute('alt') ? [] : [name(image)],
      ),
      imagesWithoutSize: images.flatMap((image) =>
        image.getAttribute('width') && image.getAttribute('height')
          ? []
          : [name(image)],
      ),
      links: [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].map(
        (a) => a.href,
      ),
    };
  });

const gzipKb = async (response: Response) => {
  try {
    return gzipSync(await response.body()).length / 1024;
  } catch {
    return 0;
  }
};

const visit = async (path: string, from: string) => {
  const page = await browser.newPage();
  const assets: Response[] = [];
  const pageProblems: string[] = [];
  // Kept apart until the page answers 200: a broken link reports only the link.
  const report = (problem: string) => pageProblems.push(`${path}: ${problem}`);
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const source = message.location().url;
    if (IGNORED_PATHS.some((p) => source.startsWith(origin + p))) return;
    report(`console error: ${message.text().split('\n')[0]}`);
  });
  page.on('pageerror', (error) =>
    report(`uncaught error: ${error.message.split('\n')[0]}`),
  );
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (
      url.origin !== origin ||
      IGNORED_PATHS.some((p) => url.pathname.startsWith(p))
    )
      return;
    if (response.status() >= 400)
      report(`${url.pathname} answered ${response.status()}`);
    if (['script', 'stylesheet'].includes(response.request().resourceType()))
      assets.push(response);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' && url.origin !== origin) {
      report(`insecure request to ${url.href} (use https)`);
    }
  });

  const response = await page.goto(origin + path, { waitUntil: 'networkidle' });
  if (!response || response.status() !== 200) {
    // Only the broken link counts, not the console noise of the error page it leads to.
    problems.push(
      `${from}: links to ${path}, which answers ${response?.status() ?? 'nothing'}`,
    );
    await page.close();
    return;
  }
  const headers = response.headers();
  for (const [name, valid] of Object.entries(SECURITY_HEADERS)) {
    if (!valid(headers[name] ?? '')) report(`missing or weak ${name} header`);
  }

  const head = await readHead(page);
  heads.set(path, head);
  if (!head.lang) report('<html> has no lang');
  if (!head.charsetFirst)
    report('<meta charset> is not the first element in <head>');
  if (!head.viewport) report('no responsive viewport meta');
  if (!head.title) report('empty <title>');
  if (!head.description) report('no meta description');
  if (!headers['content-security-policy'] && !head.csp)
    report('no Content-Security-Policy');
  if (!head.canonical) report('no canonical link');
  else if (new URL(head.canonical).pathname !== path) {
    report(`canonical points to ${head.canonical}`);
  }
  if (head.h1 === 0) report('no <h1>');
  for (const image of head.imagesWithoutAlt)
    report(`image without alt: ${image}`);
  for (const image of head.imagesWithoutSize) {
    report(`image without width and height (layout shift): ${image}`);
  }

  let js = 0;
  let css = 0;
  for (const asset of assets) {
    const kb = await gzipKb(asset);
    if (asset.request().resourceType() === 'script') js += kb;
    else css += kb;
  }
  if (js > BUDGET_KB.js)
    report(`JavaScript ${js.toFixed(0)} KB gzip, budget ${BUDGET_KB.js} KB`);
  if (css > BUDGET_KB.css)
    report(`CSS ${css.toFixed(0)} KB gzip, budget ${BUDGET_KB.css} KB`);

  for (const link of head.links) {
    const url = new URL(link);
    if (url.origin !== origin || seen.size >= MAX_PAGES) continue;
    if (/\.\w+$/.test(url.pathname) || seen.has(url.pathname)) continue;
    seen.add(url.pathname);
    queue.push({ path: url.pathname, from: path });
  }
  problems.push(...pageProblems);
  await page.close();
};

for (let next = queue.shift(); next; next = queue.shift()) {
  await visit(next.path, next.from);
}

// A missing page answers 404 and stays out of search results.
const missing = await browser.newPage();
const notFound = await missing.goto(`${origin}/check-pages-missing-page`);
if (notFound?.status() !== 404)
  fail('404 page', `status ${notFound?.status() ?? 'none'}, expected 404`);
else if (!(await readHead(missing)).noindex)
  fail('404 page', 'no <meta name="robots" content="noindex">');
await missing.close();
await browser.close();

// Titles and descriptions are unique among the pages search engines may index.
const indexed = [...heads].filter(([, head]) => !head.noindex);
for (const field of ['title', 'description'] as const) {
  const byValue = new Map<string, string[]>();
  for (const [path, head] of indexed) {
    if (head[field])
      byValue.set(head[field], [...(byValue.get(head[field]) ?? []), path]);
  }
  for (const [value, paths] of byValue) {
    if (paths.length > 1) fail(paths.join(', '), `same ${field} "${value}"`);
  }
}
for (const path of sitemapPaths) {
  if (heads.get(path)?.noindex)
    fail('/sitemap.xml', `lists ${path}, which is noindex`);
}

for (const problem of [...new Set(problems)]) console.error(`✗ ${problem}`);
console.log(
  `${heads.size} pages checked, ${new Set(problems).size} problem(s) ` +
    `(SEO, security headers, console, links, images, budget JS ${BUDGET_KB.js} KB / CSS ${BUDGET_KB.css} KB)`,
);
stop(problems.length > 0 ? 1 : 0);
```

- About 10 seconds for a small site, most of it `astro build`. It runs before every push.
- `IGNORED_PATHS` holds `/rpc/`: islands that call the API get no answer behind `astro preview`,
  and the page shows its error state, which the page and island tests cover. Add nothing else
  to it to get green.
- `BUDGET_KB` matches `DESIGN.md`'s Performance budget. Change both together, with the user.
- It needs `astro preview`, which the Node adapter supports. With an adapter that has no
  preview (Vercel, Netlify), start the built server the adapter's way instead.
- Page-level axe is not part of it (that needs `@axe-core/playwright`, a dependency to agree
  first); component a11y is `test:stories`.

## Prettier, EditorConfig, Husky and lint-staged

Same settings as the team's `space` repo, so code moves between repos without reformatting.

`.prettierrc`:

```json
{
  "plugins": ["prettier-plugin-astro"],
  "quoteProps": "as-needed",
  "trailingComma": "all",
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": true,
  "endOfLine": "auto"
}
```

`.prettierignore`:

```text
dist/
.astro/
storybook-static/
coverage/
pnpm-lock.yaml
# Skill copies and vendored lint rules: kept as their source writes them.
.claude/
tools/oxlint/anti-slop/
# Generated by shadcn: keep them as shadcn writes them, so `shadcn add` diffs stay readable.
src/components/ui/
src/lib/
```

`.editorconfig`:

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

`.lintstagedrc`:

```json
{
  "*.{js,mjs,ts,tsx,astro}": ["eslint", "oxlint", "prettier --write"],
  "*.{css,json,md,yml,yaml}": "prettier --write"
}
```

`.husky/pre-commit` and `.husky/pre-push` (created after `pnpm exec husky`, which the `prepare`
script also runs on every install):

```sh
pnpm exec lint-staged
```

```sh
pnpm typecheck && pnpm test:coverage && pnpm test:stories && pnpm test:pages
```

- ESLint in the hook has no `--fix`: a lint error (an `any`, a missing final newline) blocks the
  commit instead of being silently rewritten. Prettier does rewrite, then lint-staged re-stages.
- The push runs the tests with coverage, the story checks and the page checks, so a push below
  80%, or with a broken story, an a11y violation, missing SEO metadata or security headers, a
  console error or a page over budget, fails.
- The config needs no `eslint-config-prettier`: `typescript-eslint` strict and
  `eslint-plugin-astro` recommended carry no formatting rules.
- `prettier --write .` also formats the `AGENTS.md` and `DESIGN.md` the skill writes, and the
  4-space theme block `shadcn init` puts in `global.css`. That is expected.
- Husky installs hooks into the git repository that contains `package.json`. When the project is
  not the repository root (a monorepo package), stop and ask: the hooks belong at the root.

## Starter UI

The layouts, the site config, the theme toggle, the reusable `common/` and `layout/`
components, the welcome page and the 404 page, with their stories and tests, are in
`references/starter-ui.md`.
