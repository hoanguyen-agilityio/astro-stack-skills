# Page and islands — worked example

Ticket: *"/orders lists orders (customer, total, status) with a status filter. Pending orders have
a Cancel button."* The data layer (`src/types/order.ts`, `src/services/orders.ts`,
`src/components/orders/loadOrders.ts`) comes from `integrate-api`.

Checked on the skeleton's set (Astro 5.18, React 19, Effect 3.22, shadcn CLI 4): `lint`,
`typecheck`, tests and `build` pass, and the page ran in `pnpm dev` against a local oRPC server
through the `/rpc` proxy.

## Criteria (step 1)

- [ ] `/orders` lists every order: customer, total as money, status.
- [ ] Filter links for All / Pending / Paid / Cancelled; the active one is marked; the URL holds it.
- [ ] Unknown `?status=` values show all orders.
- [ ] Pending orders have a Cancel button. It shows "Cancelling…", then "Cancelled", or an
      error next to it with the button enabled again.
- [ ] No orders for a filter → "No orders match this filter."
- [ ] Backend down or slow → an error message, not an empty table.
- [ ] Session expired (401) → redirect to `/login`.

## src/components/orders/format.ts

```ts
import { Schema } from 'effect';

import { OrderStatus } from '@/types/order';

const isOrderStatus = Schema.is(OrderStatus);

/** ?status=pending -> 'pending'; anything else -> no filter */
export const parseStatus = (value: string | null): OrderStatus | undefined =>
  isOrderStatus(value) ? value : undefined;

export const formatMoney = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  cancelled: 'Cancelled',
};
```

`Record<OrderStatus, string>` breaks the build when a new status has no label.

## src/pages/orders.astro

```astro
---
import { Effect } from 'effect';

import BaseLayout from '@/layouts/BaseLayout.astro';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CancelOrderButton } from '@/components/orders/CancelOrderButton';
import { formatMoney, parseStatus, STATUS_LABEL } from '@/components/orders/format';
import { loadOrders } from '@/components/orders/loadOrders';
import { createOrpcClient } from '@/libs/orpcClient';

const status = parseStatus(Astro.url.searchParams.get('status'));
const client = createOrpcClient({ token: Astro.cookies.get('token')?.value });
const state = await Effect.runPromise(loadOrders(status, client));

if (state.status === 'error' && state.message === 'Please sign in again.') {
  return Astro.redirect('/login');
}

const filters = [
  { label: 'All', href: '/orders', active: status === undefined },
  ...(['pending', 'paid', 'cancelled'] as const).map((s) => ({
    label: STATUS_LABEL[s],
    href: `/orders?status=${s}`,
    active: status === s,
  })),
];
---

<BaseLayout title="Orders">
  <main class="mx-auto max-w-3xl p-6">
    <h1 class="mb-4 text-2xl font-semibold">Orders</h1>

    <nav aria-label="Filter by status" class="mb-4 flex gap-2">
      {
        filters.map((f) => (
          <a
            href={f.href}
            aria-current={f.active ? 'page' : undefined}
            class={buttonVariants({ variant: f.active ? 'default' : 'outline', size: 'sm' })}
          >
            {f.label}
          </a>
        ))
      }
    </nav>

    {state.status === 'error' && <p role="alert" class="text-destructive">{state.message}</p>}

    {state.status === 'success' && state.orders.length === 0 && <p class="text-muted-foreground">No orders match this filter.</p>}

    {
      state.status === 'success' && state.orders.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span class="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.orders.map((order) => (
              <TableRow>
                <TableCell>{order.customer}</TableCell>
                <TableCell className="tabular-nums">{formatMoney(order.totalCents)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{STATUS_LABEL[order.status]}</Badge>
                </TableCell>
                <TableCell>{order.status === 'pending' && <CancelOrderButton client:visible orderId={order.id} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }
  </main>
</BaseLayout>
```

Why it's shaped like this:
- **The skeleton sets `output: 'server'`**, so the frontmatter runs on every request. No
  `prerender` line is needed.
- **The server client carries the token**: `createOrpcClient({ token })`. Use the project's real
  session cookie name instead of `'token'`.
- **The filter is a link, not state.** It needs no JavaScript, the URL can be shared, and the
  back button works.
- **`Table` and `Badge` have no directive**, so they render as plain HTML. `CancelOrderButton` is
  the only island, and `client:visible` hydrates it when its row scrolls into view.
- **`className` on `TableCell`.** It's a React component, so `astro check` rejects `class` on it.
  Plain HTML tags keep `class`.
- **A server-rendered page has no loading state.** The HTML arrives with the data.
- Add the shadcn parts first: `pnpm dlx shadcn@4 add table badge -y`.

## src/components/orders/CancelOrderButton/index.tsx

```tsx
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { runCancel } from '../loadOrders';

interface Props {
  readonly orderId: string;
}

type State = { readonly status: 'idle' | 'pending' | 'done' } | { readonly status: 'error'; readonly message: string };

export const CancelOrderButton = ({ orderId }: Props) => {
  const [state, setState] = useState<State>({ status: 'idle' });

  const onClick = async () => {
    setState({ status: 'pending' });
    const result = await runCancel(orderId);
    setState(result.ok ? { status: 'done' } : { status: 'error', message: result.message });
  };

  if (state.status === 'done') return <span className="text-sm text-muted-foreground">Cancelled</span>;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={onClick} disabled={state.status === 'pending'}>
        {state.status === 'pending' ? 'Cancelling…' : 'Cancel'}
      </Button>
      {state.status === 'error' && (
        <span role="alert" className="text-sm text-destructive">
          {state.message}
        </span>
      )}
    </div>
  );
};
```

It uses a named export like the skeleton's `GreetingButton`, and a serializable prop
(`orderId: string`). Every outcome renders next to the button. The browser call goes to
same-origin `/rpc`, which the dev server proxies to the API, so no CORS setup is needed.

## Choosing the client directive

| Directive | Hydrates | Use for |
|---|---|---|
| *(none)* | never | display-only components, including shadcn ones |
| `client:load` | right away | the first thing the user interacts with |
| `client:idle` | when the browser is idle | needed soon, not instantly |
| `client:visible` | when scrolled into view | per-row buttons, below-the-fold widgets |
| `client:only="react"` | client only, no server render | needs `window` while rendering |

`client:load` everywhere "to be safe" ships JavaScript nobody needed. A missing directive leaves
the component rendered but dead, with no error. Both mistakes are silent, so choose on purpose.
