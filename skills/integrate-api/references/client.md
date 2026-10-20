# oRPC client — adding procedures

`code-skeleton` creates `src/libs/orpcClient.ts` with an empty `AppRouterClient`. This skill adds
each namespace the app calls. Checked with `@orpc/client` 1.15 on the skeleton's strictest
tsconfig.

## Add a namespace

```ts
import type { OrderStatus } from '@/types/order';

/**
 * The procedures this app calls, by namespace. A `type`, not an `interface`: createORPCClient
 * needs it to fit `NestedClient`, which an interface (no index signature) does not.
 */
export type AppRouterClient = {
  readonly orders: {
    readonly list: Procedure<{ readonly status?: OrderStatus | undefined }>;
    readonly cancel: Procedure<{ readonly id: string }>;
  };
};
```

- `Procedure<Input>` (from the skeleton) types the input and leaves the output `unknown`. The
  service decodes every response with a Schema, so the app never trusts an unchecked shape.
- **Use `type`.** With `interface`, `astro check` fails on `createORPCClient<AppRouterClient>`:
  `Type 'AppRouterClient' does not satisfy the constraint 'NestedClient<any>'`.
- Optional inputs need `| undefined` because of `exactOptionalPropertyTypes`.
- Get the input shapes from the backend: its contract, router or docs. Don't guess them.

## When the backend publishes its types

If the router or contract type can be imported (a shared package, a monorepo sibling), use it
instead of the hand-written type:

```ts
import type { ContractRouterClient } from '@orpc/contract';
import type { contract } from '@acme/api-contract';

export type AppRouterClient = ContractRouterClient<typeof contract>;
```

Or use `RouterClient<typeof router>` from `@orpc/server`, imported as a **type** only. Responses
still go through a Schema: the server type describes what the server should send, and doesn't
check what actually arrives.

## Tokens and where calls go

The skeleton's factory already decides the base URL:

| Caller | Base URL | Auth |
|---|---|---|
| Browser (island) | `window.location.origin` → same-origin `/rpc`, proxied to the API | the browser's cookies go along with the same-origin request |
| Server (page frontmatter) | `PUBLIC_API_URL` → the API directly | pass `token`: `createOrpcClient({ token: Astro.cookies.get('<session cookie>')?.value })` |

Use the project's real session cookie name. Never hard-code a token.

## Batching (optional)

If the server registers `BatchHandlerPlugin`, calls made in the same tick can share one request:

```ts
import { BatchLinkPlugin } from '@orpc/client/plugins';

const link = new RPCLink({
  url: `${resolveBaseUrl(baseUrl)}/rpc`,
  headers: () => (token ? { Authorization: `Bearer ${token}` } : {}),
  plugins: [new BatchLinkPlugin({ groups: [{ condition: () => true, context: {} }] })],
});
```

Leave it out if you can't confirm the server supports it.

## Errors the client throws

A failed call rejects with `ORPCError` (`code`, `status`, `message`, `data`). A network failure
rejects with a plain error, usually `TypeError`. `toApiError` in `references/service.md` turns
both into tagged errors.
