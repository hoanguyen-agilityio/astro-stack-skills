# Schema types, errors and the service

Checked on the skeleton's set (Effect 3.22, Astro 5.18, oRPC 1.15, strictest tsconfig):
`typecheck`, `lint` and the tests pass, and the service ran against a local oRPC server through
the dev proxy.

## src/types/order.ts — wire format and domain type

```ts
import { Schema } from 'effect';

export const OrderStatus = Schema.Literal('pending', 'paid', 'cancelled');
export type OrderStatus = typeof OrderStatus.Type;

/** What the server sends. */
export const OrderDto = Schema.Struct({
  id: Schema.String,
  customer_name: Schema.String,
  total_cents: Schema.Number,
  status: OrderStatus,
  created_at: Schema.Date, // Effect 3: ISO string -> Date
});

export const OrderListDto = Schema.Struct({ items: Schema.Array(OrderDto) });

/** What the app uses. */
export interface Order {
  readonly id: string;
  readonly customer: string;
  readonly totalCents: number;
  readonly status: OrderStatus;
  readonly createdAt: Date;
}
```

Export enum-like schemas (`OrderStatus`) as **values**: `develop-feature` uses `Schema.is` on them
to parse URL filters.

## src/services/errors.ts — shared tagged errors

```ts
import { ORPCError } from '@orpc/client';
import { Data } from 'effect';

export class Unauthorized extends Data.TaggedError('Unauthorized') {}
export class NotFound extends Data.TaggedError('NotFound')<{ readonly resource: string }> {}
export class ApiFailure extends Data.TaggedError('ApiFailure')<{ readonly status: number; readonly message: string }> {}
export class NetworkError extends Data.TaggedError('NetworkError')<{ readonly cause: unknown }> {}

export type ApiError = Unauthorized | NotFound | ApiFailure | NetworkError;

/** One place that turns whatever the oRPC call threw into a typed error. */
export const toApiError =
  (resource: string) =>
  (cause: unknown): ApiError => {
    if (cause instanceof ORPCError) {
      if (cause.status === 401) return new Unauthorized();
      if (cause.status === 404) return new NotFound({ resource });
      return new ApiFailure({ status: cause.status, message: cause.message });
    }
    return new NetworkError({ cause });
  };
```

Effect adds two more tags the UI must handle: `TimeoutException` (from `Effect.timeout`) and
`ParseError` (from decoding). Write `Data.TaggedError('Unauthorized')` with no `<{}>`: the
skeleton's ESLint config rejects `{}` as a type.

## src/services/orders.ts — one function per procedure

```ts
import { Duration, Effect, Schedule, Schema } from 'effect';

import { createOrpcClient, type AppRouterClient } from '@/libs/orpcClient';
import { OrderListDto, type Order, type OrderStatus } from '@/types/order';

import { toApiError } from './errors';

const toOrder = (dto: typeof OrderListDto.Type['items'][number]): Order => ({
  id: dto.id,
  customer: dto.customer_name,
  totalCents: dto.total_cents,
  status: dto.status,
  createdAt: dto.created_at,
});

const decodeOrderList = Schema.decodeUnknown(OrderListDto);

/** Reads only: retry transient failures. Never retry 401/404 or a schema mismatch. */
const resilient = <A, E extends { readonly _tag: string }, R>(self: Effect.Effect<A, E, R>) =>
  self.pipe(
    Effect.timeout(Duration.seconds(5)),
    Effect.retry({
      schedule: Schedule.exponential('200 millis'),
      times: 2,
      while: (e) => e._tag === 'NetworkError' || e._tag === 'TimeoutException',
    }),
  );

interface CallOptions {
  /** Server pages pass a client carrying the user's token; islands use the default. */
  readonly client?: AppRouterClient | undefined;
}

export const listOrders = ({ status, client }: CallOptions & { readonly status?: OrderStatus | undefined } = {}) =>
  Effect.tryPromise({
    try: (signal) => (client ?? createOrpcClient()).orders.list(status ? { status } : {}, { signal }),
    catch: toApiError('orders'),
  }).pipe(
    resilient,
    Effect.flatMap((raw) => decodeOrderList(raw)),
    Effect.map((list) => list.items.map(toOrder)),
  );

/** Mutations: timeout, no retry. A retried cancel could run twice. */
export const cancelOrder = ({ id, client }: CallOptions & { readonly id: string }) =>
  Effect.tryPromise({
    try: (signal) => (client ?? createOrpcClient()).orders.cancel({ id }, { signal }),
    catch: toApiError(`order ${id}`),
  }).pipe(Effect.timeout(Duration.seconds(5)), Effect.asVoid);
```

Why each piece is there:
- **`signal`**: `Effect.tryPromise` hands the call an `AbortSignal` that fires when the Effect is
  interrupted, so a cancelled read stops its request.
- **`client ?? createOrpcClient()`**: the default client is created at call time, so the browser
  gets the same-origin URL and the server gets `PUBLIC_API_URL`.
- **`times: 2`** means up to 3 calls in total. A test checks it.

## Effect 3 → 4 names

The examples use Effect 3, the skeleton's pin. If a repo is on Effect 4, these names differ
(checked against `effect` 4.0.5):

| Effect 3 (used above) | Effect 4 |
|---|---|
| `Schema.Literal('a', 'b')` | `Schema.Literals(['a', 'b'])` |
| `Schema.Union(A, B)` | `Schema.Union([A, B])` |
| `Schema.Date` (string → Date) | `Schema.DateFromString` (v4's `Schema.Date` accepts only `Date` objects) |
| `Schema.decodeUnknown` | `Schema.decodeUnknownEffect` |
| error tag `ParseError` | `SchemaError` |
| error tag `TimeoutException` | `TimeoutError` |
| `Effect.catchAll` | `Effect.catch` |
| `Effect.either` / `Either` | `Effect.result` / `Result` |

`Effect.tryPromise`, `Data.TaggedError`, `Effect.catchTags`, `Effect.retry`, `Effect.timeout`,
`Schema.is` and `Effect.runPromise` keep their names.
