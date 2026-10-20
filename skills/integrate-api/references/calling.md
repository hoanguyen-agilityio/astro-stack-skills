# Outcome helpers and tests

A service returns an `Effect` that can fail with several tags. Pages and islands shouldn't deal
with that. The outcome helpers turn every result into a plain value the UI can render.

## src/components/orders/loadOrders.ts

```ts
import { Effect } from 'effect';

import type { AppRouterClient } from '@/libs/orpcClient';
import { cancelOrder, listOrders } from '@/services/orders';
import type { Order, OrderStatus } from '@/types/order';

export type OrdersState =
  | { readonly status: 'success'; readonly orders: readonly Order[] }
  | { readonly status: 'error'; readonly message: string };

/** Every failure becomes a UI state, so the error channel is `never`. */
export const loadOrders = (filter?: OrderStatus, client?: AppRouterClient): Effect.Effect<OrdersState> =>
  listOrders({ status: filter, client }).pipe(
    Effect.map((orders): OrdersState => ({ status: 'success', orders })),
    Effect.catchTags({
      Unauthorized: () => Effect.succeed<OrdersState>({ status: 'error', message: 'Please sign in again.' }),
      NotFound: () => Effect.succeed<OrdersState>({ status: 'success', orders: [] }),
      TimeoutException: () => Effect.succeed<OrdersState>({ status: 'error', message: 'The server is slow. Try again.' }),
      NetworkError: () => Effect.succeed<OrdersState>({ status: 'error', message: 'No connection. Check your network.' }),
      ApiFailure: (e) => Effect.succeed<OrdersState>({ status: 'error', message: e.message }),
      ParseError: () => Effect.succeed<OrdersState>({ status: 'error', message: 'Unexpected data from the server.' }),
    }),
  );

export type CancelResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

export const runCancel = (id: string): Promise<CancelResult> =>
  Effect.runPromise(
    cancelOrder({ id }).pipe(
      Effect.map((): CancelResult => ({ ok: true })),
      Effect.catchTags({
        Unauthorized: () => Effect.succeed<CancelResult>({ ok: false, message: 'Please sign in again.' }),
        NotFound: () => Effect.succeed<CancelResult>({ ok: false, message: 'This order no longer exists.' }),
        TimeoutException: () => Effect.succeed<CancelResult>({ ok: false, message: 'The server is slow. Try again.' }),
        NetworkError: () => Effect.succeed<CancelResult>({ ok: false, message: 'No connection.' }),
        ApiFailure: (e) => Effect.succeed<CancelResult>({ ok: false, message: e.message }),
      }),
    ),
  );
```

- The return type `Effect.Effect<OrdersState>` (error `never`) is the check: if a tag is missing
  from `catchTags`, `pnpm typecheck` fails.
- `load<Resource>` stays an `Effect`, so the page can run it and tests can mock it with
  `Effect.succeed(...)`. `run<Action>` returns a `Promise`, which is what a click handler awaits.
- These files live in `src/components/<resource>/`, next to the islands that use them.

## Running them

```astro
---
// in a page's frontmatter (output: 'server' renders it per request)
const client = createOrpcClient({ token: Astro.cookies.get('<session cookie>')?.value });
const state = await Effect.runPromise(loadOrders(status, client));
if (state.status === 'error' && state.message === 'Please sign in again.') {
  return Astro.redirect('/login');
}
---
```

```tsx
// in an island's click handler
const result = await runCancel(orderId);
```

For an island that loads data after hydration, run the Effect inside `useEffect` with an
`AbortController` and pass `{ signal }` to `Effect.runPromise`, so an unmount or a fast filter
change interrupts the earlier request.

## Tests — src/services/__tests__/orders.test.ts

```ts
import { ORPCError } from '@orpc/client';
import { Effect, Exit } from 'effect';
import { describe, expect, it } from 'vitest';

import type { AppRouterClient } from '@/libs/orpcClient';
import { listOrders } from '@/services/orders';

type List = AppRouterClient['orders']['list'];

// Test-only cast: the service only touches `orders.list`.
const fakeClient = (list: List) => ({ orders: { list } }) as unknown as AppRouterClient;

const failureTag = async (list: List) => {
  const exit = await Effect.runPromiseExit(listOrders({ client: fakeClient(list) }));
  return Exit.isFailure(exit) ? JSON.stringify(exit.cause) : 'success';
};

describe('listOrders', () => {
  it('decodes the wire format into orders', async () => {
    const client = fakeClient(async () => ({
      items: [{ id: '1', customer_name: 'An', total_cents: 1250, status: 'pending', created_at: '2026-10-20T08:00:00.000Z' }],
    }));
    const orders = await Effect.runPromise(listOrders({ client }));
    expect(orders[0]?.customer).toBe('An');
    expect(orders[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('fails with Unauthorized on 401', async () => {
    expect(await failureTag(async () => { throw new ORPCError('UNAUTHORIZED'); })).toContain('Unauthorized');
  });

  it('fails with NotFound on 404', async () => {
    expect(await failureTag(async () => { throw new ORPCError('NOT_FOUND'); })).toContain('NotFound');
  });

  it('fails with ParseError when the server sends the wrong shape', async () => {
    expect(await failureTag(async () => ({ items: [{ id: 1 }] }))).toContain('ParseError');
  });

  it('retries a network failure twice, then fails with NetworkError', async () => {
    let calls = 0;
    const tag = await failureTag(async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    });
    expect(tag).toContain('NetworkError');
    expect(calls).toBe(3);
  });
});
```

## Tests — src/components/orders/__tests__/loadOrders.test.ts

```ts
import { Effect } from 'effect';
import { expectTypeOf, it } from 'vitest';

import { loadOrders, type OrdersState } from '../loadOrders';

it('handles every error, so the error channel is never', () => {
  expectTypeOf(loadOrders()).toEqualTypeOf<Effect.Effect<OrdersState>>();
});
```

The skeleton's Vitest config only collects `src/**/*.test.{ts,tsx}`. Tests in a top-level `test/`
folder are never run.
