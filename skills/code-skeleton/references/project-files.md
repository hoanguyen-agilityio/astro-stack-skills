# Skeleton files

Starting contents for every file `code-skeleton` writes. Adapt names, the adapter and versions
to the repo; keep the behavior. If the repo already has one of these files, merge the missing
parts in rather than overwriting it.

## `package.json`

Dependencies are added by the `pnpm add` commands of each layer in step 2a.

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
    "test": "vitest run",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
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

const { PUBLIC_API_URL } = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

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

## `src/styles/global.css` and `src/layouts/BaseLayout.astro`

```css
@import "tailwindcss";
```

`shadcn init` appends its imports and theme variables to this file. Leave them in place.

```astro
---
import '@/styles/global.css';

interface Props {
  title: string;
}

const { title } = Astro.props;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

## `eslint.config.js`

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig(
  { ignores: ['dist', '.astro', 'node_modules', 'storybook-static'] },
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
    },
  },
);
```

## `vitest.config.ts` and `vitest.setup.ts`

```ts
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
```

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
export type Procedure<TInput> = Client<Record<never, never>, TInput, unknown, Error>;

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

export const createOrpcClient = ({ token, baseUrl }: OrpcClientOptions = {}): AppRouterClient => {
  const link = new RPCLink({
    url: `${resolveBaseUrl(baseUrl)}/rpc`,
    headers: () => (token ? { Authorization: `Bearer ${token}` } : {}),
  });

  return createORPCClient<AppRouterClient>(link);
};
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
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y', '@storybook/addon-themes'],
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
  decorators: [withThemeByClassName({ themes: { light: '', dark: 'dark' }, defaultTheme: 'light' })],
  tags: ['autodocs'],
};

export default preview;
```

- **Every React story sets `parameters: { renderer: 'react' }`** in its meta. The framework
  renders stories with Astro by default, and a React story without it fails with
  `Renderer 'astro' not found`.
- Stories are `<Name>.stories.tsx` inside the component's folder. Astro stories default-import
  `./index.astro`; React stories import from `'.'` and take their types from `@storybook/react`.
- Install by hand (step 2). `storybook init` does not recognise Astro, asks questions, and adds
  example stories.
- pnpm warns that the framework wants `vitest@^4`. That peer is for its optional Vitest
  integration; Storybook and the stories work on the skeleton's Vitest 3.
- Fixtures shared by stories and tests live in `src/mocks/<resource>.ts`, in the wire format the
  API sends, so stories go through the same Schema decoding as the app.

## Smoke island, its test and its story

`src/components/home/GreetingButton/index.tsx`:

```tsx
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export const GreetingButton = () => {
  const [clicked, setClicked] = useState(false);

  return (
    <Button onClick={() => setClicked(true)}>{clicked ? 'Stack is running' : 'Check stack'}</Button>
  );
};
```

`src/pages/index.astro`:

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import { GreetingButton } from '@/components/home/GreetingButton';
---

<BaseLayout title="Home">
  <main class="mx-auto max-w-2xl p-6">
    <GreetingButton client:load />
  </main>
</BaseLayout>
```

`src/components/home/GreetingButton/__test__/index.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GreetingButton } from '..';

describe('GreetingButton', () => {
  it('confirms the stack after a click', async () => {
    render(<GreetingButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Check stack' }));

    expect(screen.getByRole('button', { name: 'Stack is running' })).toBeInTheDocument();
  });
});
```

`src/components/home/GreetingButton/GreetingButton.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import { GreetingButton } from '.';

const meta = {
  title: 'Home/GreetingButton',
  component: GreetingButton,
  parameters: { renderer: 'react' },
} satisfies Meta<typeof GreetingButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Clicked: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Check stack' }));
    await expect(canvas.getByRole('button', { name: 'Stack is running' })).toBeInTheDocument();
  },
};
```
