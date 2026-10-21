# Analysis template

Save as `docs/analysis/<slug>.md` (lanes `normal` and `high-risk`), or paste the same sections
into the reply (lane `tiny`). Delete a section only when it truly does not apply, and keep the
headings in this order.

```markdown
# <Title>

Kind: setup | api | feature · Lane: tiny | normal | high-risk · Flags: <list or none>
Source: <ticket id / link / file / "chat request, <date>">

## Request

<The request in two or three sentences, in your own words. Quote only the parts that are
ambiguous.>

## Current state

<What exists today, with paths. "Empty directory" for a new project.>

## Scope

In: <bullets>
Out: <bullets: what was asked for elsewhere, or deliberately left for later>

## Acceptance criteria

### AC1 — <short name>
Given <precondition>
When <action>
Then <observable result>

### AC2 — …

## Edge cases

| Case | Expected | Source |
|------|----------|--------|
| <empty list> | <message shown> | spec / inferred / open question |

## Open questions

| # | Question | Blocks | Who can answer |
|---|----------|--------|----------------|
| Q1 | <question> | AC2 | <PO / designer / backend / user> |

## Assumptions

| # | Assumption | Source |
|---|------------|--------|
| A1 | <assumption> | <skill default / repo file / mirrors Q1> |

## Plan

| Module / file | Kind | Depends on | Notes |
|---------------|------|------------|-------|
| `src/...` | new / extend / exists | — | <astro or island, directive> |
| `src/components/<feature>/<Name>/<Name>.stories.tsx` | new / extend | the component | <states: data, empty, error, …> |

Build order: <1, 2, 3>
Not covered: <criteria skipped and why>

## Test scenarios

| AC | Test | Level |
|----|------|-------|
| AC1 | <what the test asserts> | unit / component / page / story / build |

Ready: <ACs> · Blocked: <ACs (Qn)> · Next: <skill>
```

## Example — a `setup` request

Request: "Create project lunch-order, oRPC pointing to http://localhost:8787/rpc".

```markdown
# lunch-order skeleton

Kind: setup · Lane: tiny · Flags: none
Source: chat request, 2026-10-20

## Request
New Astro + React islands project named lunch-order whose oRPC client calls
http://localhost:8787/rpc.

## Current state
Empty directory. Node 22.x, pnpm available.

## Scope
In: skeleton, configs, oRPC client factory, shadcn, lint, tests, starter UI (layouts, reusable
common components, welcome and 404 pages).
Out: API services (integrate-api), pages and features (develop-feature).

## Acceptance criteria
### AC1 — Gates pass
Given a fresh install
When pnpm lint, pnpm typecheck, pnpm test and pnpm build run
Then all four exit 0

### AC2 — API URL from env
Given .env with PUBLIC_API_URL=http://localhost:8787
When the oRPC client is created on the server
Then it targets http://localhost:8787/rpc and no URL is hard-coded in src/

### AC3 — Island renders
Given pnpm dev
When / is opened
Then a shadcn Button rendered by a React island is visible

## Assumptions
| # | Assumption | Source |
|---|------------|--------|
| A1 | pnpm, @astrojs/node adapter, shadcn preset nova | code-skeleton defaults |

Ready: AC1–AC3 · Blocked: none · Next: code-skeleton step 1
```
