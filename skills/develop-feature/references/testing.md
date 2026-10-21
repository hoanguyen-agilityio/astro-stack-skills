# Testing a feature

Each layer mocks the one below it. Tests live in `__test__/` next to the code (a component's in
`<Name>/__test__/index.test.tsx`, a helper's in the feature folder's `__test__/`): the skeleton's
Vitest config only collects `src/**/*.test.{ts,tsx}`, and its default environment is jsdom.

| Layer | Tool | Mock |
|---|---|---|
| Helpers (`format.ts`) | Vitest | nothing |
| Islands (`CancelOrderButton/index.tsx`) | Testing Library | the outcome helper (`runCancel`) |
| Page (`orders.astro`) | Astro Container API | the loader (`loadOrders`) |
| Services | see `integrate-api` | a fake oRPC client |

All tests below pass on the skeleton's set (Vitest 3, Astro 5.18, React 19).

## src/components/orders/__test__/format.test.ts

```ts
import { describe, expect, it } from 'vitest';

import { formatMoney, parseStatus } from '../format';

describe('parseStatus', () => {
  it('accepts a known status', () => expect(parseStatus('paid')).toBe('paid'));
  it('ignores unknown or missing values', () => {
    expect(parseStatus('shipped')).toBeUndefined();
    expect(parseStatus(null)).toBeUndefined();
  });
});

describe('formatMoney', () => {
  it('formats cents as money', () => expect(formatMoney(1250)).toBe('$12.50'));
});
```

## src/components/orders/CancelOrderButton/__test__/index.test.tsx

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CancelOrderButton } from '..';
import { runCancel } from '../../loadOrders';

vi.mock('../../loadOrders', () => ({ runCancel: vi.fn() }));

describe('CancelOrderButton', () => {
  it('shows Cancelled after a successful cancel', async () => {
    vi.mocked(runCancel).mockResolvedValue({ ok: true });
    render(<CancelOrderButton orderId="1" />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(runCancel).toHaveBeenCalledWith('1');
  });

  it('shows the error and keeps the button for a retry', async () => {
    vi.mocked(runCancel).mockResolvedValue({ ok: false, message: 'This order no longer exists.' });
    render(<CancelOrderButton orderId="2" />);

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This order no longer exists.');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });
});
```

Query by role and visible text, the way a user finds things. Mock the outcome helper, not
`fetch`: the island's job is turning outcomes into UI.

## src/components/orders/__test__/orders-page.test.ts

```ts
// @vitest-environment node
import { getContainerRenderer } from '@astrojs/react';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import OrdersPage from '@/pages/orders.astro';

import { loadOrders } from '../loadOrders';

vi.mock('../loadOrders', () => ({ loadOrders: vi.fn(), runCancel: vi.fn() }));

const render = async (url = 'http://localhost/orders') => {
  const container = await AstroContainer.create({ renderers: await loadRenderers([getContainerRenderer()]) });
  return container.renderToResponse(OrdersPage, { request: new Request(url) });
};

describe('/orders', () => {
  it('lists orders with a Cancel button only for pending ones', async () => {
    vi.mocked(loadOrders).mockReturnValue(
      Effect.succeed({
        status: 'success',
        orders: [
          { id: '1', customer: 'An', totalCents: 1250, status: 'pending', createdAt: new Date() },
          { id: '2', customer: 'Binh', totalCents: 900, status: 'paid', createdAt: new Date() },
        ],
      }),
    );
    const html = await (await render()).text();
    expect(html).toContain('$12.50');
    expect(html.match(/>Cancel</g)).toHaveLength(1);
  });

  it('passes the status filter from the URL', async () => {
    vi.mocked(loadOrders).mockReturnValue(Effect.succeed({ status: 'success', orders: [] }));
    const html = await (await render('http://localhost/orders?status=paid')).text();
    expect(vi.mocked(loadOrders).mock.calls.at(-1)?.[0]).toBe('paid');
    expect(html).toContain('No orders match this filter.');
  });

  it('shows the error state', async () => {
    vi.mocked(loadOrders).mockReturnValue(Effect.succeed({ status: 'error', message: 'No connection. Check your network.' }));
    expect(await (await render()).text()).toContain('No connection. Check your network.');
  });

  it('redirects to /login on 401', async () => {
    vi.mocked(loadOrders).mockReturnValue(Effect.succeed({ status: 'error', message: 'Please sign in again.' }));
    const res = await render();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login');
  });
});
```

- **`// @vitest-environment node`**: page rendering runs on the server, so this file opts out of
  the skeleton's jsdom default.
- **`renderToResponse`** instead of `renderToString`, so the redirect's status and `location`
  header can be asserted.
- **Mocking `loadOrders` with `Effect.succeed(...)`** lets each test choose an outcome without a
  server. `request: new Request(url)` drives `Astro.url`, so the URL filter can be tested.
- **The Container API is `experimental_AstroContainer`** in Astro 5 and 7. On Astro 5, import the
  React renderer from `@astrojs/react`; on Astro 7, from `@astrojs/react/container-renderer`.

## Run before calling it done

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test:coverage && pnpm build
```

`test:coverage` fails below 80% (lines, functions, branches, statements). Add tests for the
uncovered branches; never lower the thresholds or widen `coverage.exclude` to pass.

`typecheck` is `astro check`. It also checks `.astro` files, which plain `tsc` can't read.
