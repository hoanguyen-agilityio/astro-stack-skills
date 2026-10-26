# Stories — one per state, next to the component

Every component the feature adds or changes, `.astro` or React, ships a story file next to it. A
story is the component in one state, with fixed data and no network, so a reviewer can see every
state in both themes without running the backend.

The skeleton's Storybook uses `@storybook-astro/framework`: `.astro` stories render on the server
through Astro's Container API, React stories render in the browser. Do not rewrite an `.astro`
component as React just to give it a story.

Stories are checked by `pnpm typecheck` like any other `.ts`/`.tsx` file. They are not a fifth
gate.

## What to cover

| Component kind | File | Stories |
|---|---|---|
| `.astro` display component | `<Name>/<Name>.stories.tsx` | the data state, empty, and each variant its props allow |
| React display component | `<Name>/<Name>.stories.tsx` | each variant its props allow (e.g. each status) |
| React island that loads after hydration | `<Name>/<Name>.stories.tsx` | loading, empty, error, data |
| React island with an action | `<Name>/<Name>.stories.tsx` | idle, pending, success, failure, each driven by a `play` function |

Name stories after the state a person sees (`Empty`, `CancelFails`), not after props. Pages
(`src/pages/*.astro`) have no stories; their states are covered by the page test.

## Data: fixtures, not the network

- Shared fixtures live in `src/mocks/<resource>.ts`, in the **wire format** the API sends (ISO
  strings, not `Date`). Export a decoded copy for components that take the domain type:

  ```ts
  export const rawOrders = [/* … */] as const;
  export const orders: readonly Order[] = Schema.decodeUnknownSync(Schema.Array(Order))(rawOrders);
  ```

- `.astro` components get their data as props, so their stories only pass `args`. They render on
  the server and cannot use `sb.mock`.
- React islands are mocked at the same seam as their tests: the outcome helper
  (`src/components/<resource>/load<Resource>.ts`). Register each mocked module **once** in
  `.storybook/preview.ts`, next to the skeleton's `orpcClient` mock, then set the result per story
  with `mocked(...)` in `beforeEach`:

  ```ts
  sb.mock(import('../src/components/orders/loadOrders.ts'), { spy: true });
  ```

## An `.astro` component: src/components/orders/OrderSummary/OrderSummary.stories.tsx

```ts
import { orders } from '@/mocks/orders';

import OrderSummary from './index.astro';

export default {
  title: 'Orders/OrderSummary',
  component: OrderSummary,
  args: { orders },
};

export const WithOrders = {};

export const Empty = { args: { orders: [] } };

export const WithFooterNote = {
  args: { slots: { footer: '<p>Prices include VAT.</p>' } },
};
```

- Default-import `./index.astro`. The file is `.tsx` like every story, even without JSX.
- Props go in `args`. Named slots go in `args.slots.<name>` as an HTML string (`default` for the
  default slot). Slot HTML is sanitized with conservative defaults.
- `Date` props survive both `storybook dev` and `storybook build`.

## A React island: src/components/orders/CancelOrderButton/CancelOrderButton.stories.tsx

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { expect, mocked } from 'storybook/test';

import { CancelOrderButton } from '.';
import { runCancel } from '../loadOrders';

const meta = {
  title: 'Orders/CancelOrderButton',
  component: CancelOrderButton,
  // React component: the Astro framework renders stories with Astro unless told otherwise.
  parameters: { renderer: 'react' },
  args: { orderId: '1' },
  beforeEach: () => {
    mocked(runCancel).mockResolvedValue({ ok: true });
  },
} satisfies Meta<typeof CancelOrderButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Pending: Story = {
  beforeEach: () => {
    mocked(runCancel).mockReturnValue(new Promise(() => undefined));
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(canvas.getByRole('button', { name: 'Cancelling…' })).toBeDisabled();
  },
};

export const Cancelled: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(await canvas.findByText('Cancelled')).toBeInTheDocument();
  },
};

export const CancelFails: Story = {
  beforeEach: () => {
    mocked(runCancel).mockResolvedValue({ ok: false, message: 'This order no longer exists.' });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('This order no longer exists.');
  },
};
```

- **`parameters: { renderer: 'react' }` is required** on every React story's meta. Without it the
  story fails with `Renderer 'astro' not found`.
- Types come from `@storybook/react`; `expect`, `mocked`, `within`, `fn` from `storybook/test`.
- `satisfies Meta<typeof …>` keeps `args` type-checked against the props.
- Content rendered in a portal (dialogs, popovers) is outside `canvas`. Query it with
  `within(canvasElement.ownerDocument.body)`.
- Name a helper that stubs a module `stub…`, not `use…`: the React hooks lint rule treats `use…`
  functions as hooks and rejects calling them in `beforeEach`.

Give width-dependent components a realistic width: in React stories a decorator
(`decorators: [(Story) => <div className="w-80">{Story()}</div>]`); for `.astro` stories, size the
component's own root or accept the padded canvas.

## Check before calling it done

```bash
pnpm test:stories
```

It builds Storybook and opens every story in Chromium, in light and in dark. A story fails when
it throws while rendering, its `play` function fails, or the a11y addon finds a violation. Each
failure names the story, the theme and the rule, with the first element it hit:

```text
✗ orders-statusbadge--pending [light] ./src/components/orders/StatusBadge/StatusBadge.stories.tsx
    a11y color-contrast (serious): Elements must meet minimum color contrast ratio thresholds, 1 node(s), first: .inline-flex
```

Fix the cause: a token with too little contrast goes back to `DESIGN.md` and `global.css`, a
missing label goes into the markup. Then run the gate again. Never tag a story `!test` or turn
off an a11y rule in `parameters.a11y` to get green; that is weakening a gate.

`pnpm storybook` is for looking around while you build; the gate is what proves it.
