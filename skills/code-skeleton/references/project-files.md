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
| `.jscpd.json` | copy-paste detection for `pnpm dup`, used by `review-code` |
| `.prettierrc`, `.prettierignore`, `.editorconfig` | the team's `space` style: single quotes, trailing commas, 80 columns, Astro plugin |
| `.husky/pre-commit`, `.husky/pre-push`, `.lintstagedrc` | ESLint + Prettier on staged files before a commit; typecheck, tests with 80% coverage and story checks before a push |
| `vitest.config.ts`, `vitest.setup.ts` | `getViteConfig`, jsdom, jest-dom, v8 coverage with 80% thresholds |
| `.env.example`, `.env`, `src/env.d.ts` | `PUBLIC_API_URL` placeholder, local copy (gitignored), its type |
| `src/libs/orpcClient.ts` | client factory: `RPCLink` to `${PUBLIC_API_URL}/rpc`, auth header; router type starts empty |
| `.storybook/main.ts`, `preview.ts` | `@storybook-astro/framework` + `react()`; `global.css`, theme toggle, a11y, `createOrpcClient` mocked |
| `scripts/check-stories.ts` | `pnpm test:stories`: every story in Chromium, light and dark; fails on a render error, a failing `play` or an a11y violation |

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
    "lint": "eslint .",
    "dup": "jscpd",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test:stories": "storybook build --quiet && node scripts/check-stories.ts",
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
  "exclude": ["dist", "storybook-static"],
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

const { PUBLIC_API_URL } = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  '',
);

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
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
  { ignores: ['dist', '.astro', 'node_modules', 'storybook-static', 'coverage'] },
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

`eol-last` makes `pnpm lint` and the pre-commit hook report a missing final newline instead of
Prettier fixing it silently. It is one of ESLint's deprecated formatting rules, still shipped in
ESLint 9; it needs no extra plugin and does not conflict with Prettier, which writes the same
newline.

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
```

```ts
interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string;
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

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

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
          const type = TYPES[extname(path)] ?? 'application/octet-stream';
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
  "*.{js,mjs,ts,tsx,astro}": ["eslint", "prettier --write"],
  "*.{css,json,md,yml,yaml}": "prettier --write"
}
```

`.husky/pre-commit` and `.husky/pre-push` (created after `pnpm exec husky`, which the `prepare`
script also runs on every install):

```sh
pnpm exec lint-staged
```

```sh
pnpm typecheck && pnpm test:coverage && pnpm test:stories
```

- ESLint in the hook has no `--fix`: a lint error (an `any`, a missing final newline) blocks the
  commit instead of being silently rewritten. Prettier does rewrite, then lint-staged re-stages.
- The push runs the tests with coverage and the story checks, so a push below 80%, or with a
  broken story or an a11y violation, fails.
- The config needs no `eslint-config-prettier`: `typescript-eslint` strict and
  `eslint-plugin-astro` recommended carry no formatting rules.
- `prettier --write .` also formats the `CLAUDE.md` and `DESIGN.md` the skill writes, and the
  4-space theme block `shadcn init` puts in `global.css`. That is expected.
- Husky installs hooks into the git repository that contains `package.json`. When the project is
  not the repository root (a monorepo package), stop and ask: the hooks belong at the root.

## Starter UI

The layouts, the site config, the theme toggle, the reusable `common/` and `layout/`
components, the welcome page and the 404 page, with their stories and tests, are in
`references/starter-ui.md`.
