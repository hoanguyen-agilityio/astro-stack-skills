# Skeleton files

Starting contents for every file `code-skeleton` writes. Adapt names, the adapter and versions
to the repo; keep the behavior. If the repo already has one of these files, merge the missing
parts in rather than overwriting it.

## `package.json` scripts

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "astro check",
    "lint": "eslint .",
    "test": "vitest run"
  }
}
```

## `tsconfig.json`

```json
{
  "extends": "astro/tsconfigs/strictest",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"],
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
  { ignores: ['dist', '.astro', 'node_modules'] },
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

Make sure `.env` is in `.gitignore`.

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

## Smoke island and its test

`src/components/home/GreetingButton.tsx`:

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

`src/components/home/__tests__/GreetingButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GreetingButton } from '../GreetingButton';

describe('GreetingButton', () => {
  it('confirms the stack after a click', async () => {
    render(<GreetingButton />);

    await userEvent.click(screen.getByRole('button', { name: 'Check stack' }));

    expect(screen.getByRole('button', { name: 'Stack is running' })).toBeInTheDocument();
  });
});
```

