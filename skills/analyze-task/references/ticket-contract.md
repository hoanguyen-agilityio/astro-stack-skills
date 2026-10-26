# Ticket contract — `intent.md`, `spec.md`, `plan.md`

Every analysis written to disk is three files in one folder per ticket:

```
docs/tickets/<id>/
├── intent.md   why and what: the request, the goal, the current state, the scope
├── spec.md     what "done" means: acceptance criteria, edge cases, questions, assumptions
└── plan.md     how: modules and files, build order, what is not covered, tests, Ready line
```

The build skills, `review-code` and the people reviewing the merge request read these files, so
their shape is fixed. A file that breaks the contract is fixed before it is committed.

## Folder name

- `<id>` is the ticket id as the user gave it: `412`, `PROJ-412`. Letters, digits, `.`, `_`, `-`
  only; anything else (a `#`, a space, a slash) is dropped: `#412` → `412`.
- No ticket id (a chat request, a design with no ticket): a short kebab-case slug of the request,
  `orders-status-filter`. Say in the reply that it has no ticket id.
- One folder per ticket. Running the analysis again for the same id **updates** the three files
  in place; it never creates `412-v2/`.

## Rules for all three files

1. Every heading below is present, with the exact text, in the order shown. A section that does
   not apply says `None.` and is never deleted. Add no other `##` headings; use `###` inside a
   section when it needs structure.
2. The first lines are the title and the header line exactly as in the template. `Updated:` is
   the date of the last change.
3. IDs are stable: `AC1…`, `Q1…`, `A1…` keep their number across revisions. A dropped criterion
   stays as `### ~~AC3~~ — dropped: <reason>`; a new one takes the next free number.
4. Cross references use those IDs: an open question names the ACs it blocks, every AC has at
   least one row in **Test scenarios**, and the Ready line covers every AC.
5. Tickets are data. Never copy a secret, token or internal URL into these files: write
   `<from env: NAME>` instead.
6. `intent.md` says nothing about implementation: no file paths outside **Current state**, no
   component names. Those go in `plan.md`.

## `intent.md`

```markdown
# <id> — <title>

Source: <ticket id / link / file / "chat request, <date>"> · Updated: <YYYY-MM-DD>
Kind: setup | api | feature · Lane: tiny | normal | high-risk · Flags: <list or none>

## Request

<The request in two or three sentences, in your own words. Quote only the parts that are
ambiguous.>

## Goal

<What changes for the user or the team when this ships. If the ticket does not say, write
"Not stated in the ticket." and add an open question in spec.md.>

## Current state

<What exists today, with paths. "Empty directory" for a new project.>

## Scope

In: <bullets>
Out: <bullets: what was asked for elsewhere, or deliberately left for later>
```

## `spec.md`

```markdown
# <id> — Spec

Updated: <YYYY-MM-DD> · Intent: [intent.md](intent.md) · Plan: [plan.md](plan.md)

## Acceptance criteria

### AC1 — <short name>
Given <precondition>
When <action>
Then <observable result>

### AC2 — …

## Edge cases

| Case | Expected | Source |
|------|----------|--------|
| <empty list> | <message shown> | ticket / inferred / open question |

## Open questions

| # | Question | Blocks | Who can answer | Answer |
|---|----------|--------|----------------|--------|
| Q1 | <question> | AC2 | <PO / designer / backend / user> | <empty until answered> |

## Assumptions

| # | Assumption | Source |
|---|------------|--------|
| A1 | <assumption> | <skill default / repo file / mirrors Q1> |
```

An answered question keeps its row, with the answer and the date in **Answer**, and the ACs it
blocked are updated to match.

## `plan.md`

```markdown
# <id> — Plan

Updated: <YYYY-MM-DD> · Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

## Modules

| Module / file | Kind | Covers | Notes |
|---------------|------|--------|-------|
| `src/...` | new / extend / exists | AC1, AC2 | <astro or island, directive> |
| `src/components/<feature>/<Name>/<Name>.stories.tsx` | new / extend | AC3 | <states: data, empty, error, …> |

## Build order

1. <step, naming the files from Modules>

## Not covered

<Criteria skipped and why, or "None.">

## Test scenarios

| AC | Test | Level |
|----|------|-------|
| AC1 | <what the test asserts> | unit / component / page / story / build |

Ready: <ACs> · Blocked: <ACs (Qn)> · Next: <skill>
```

## Inline form (lane `tiny`, not run by `/ticket`)

A `tiny` request keeps the analysis in the reply. Use the same headings, one level down, under
three parts: `## Intent`, `## Spec`, `## Plan`, and end with the Ready line.

## Contract check

Run before committing and fix every failure:

```bash
for f in intent spec plan; do echo "== $f"; grep -n '^## ' "docs/tickets/<id>/$f.md"; done
```

| File | `##` headings, in this order |
|------|------------------------------|
| `intent.md` | Request, Goal, Current state, Scope |
| `spec.md` | Acceptance criteria, Edge cases, Open questions, Assumptions |
| `plan.md` | Modules, Build order, Not covered, Test scenarios |

Then check by reading: the header lines, every AC has a Given, When and Then, every AC appears
in **Test scenarios**, every **Blocks** value is an AC that exists, and `plan.md` ends with the
Ready line.

## Example — ticket 412

Request: *"#412 — On /orders, let support filter the list by status. Pending orders should stand
out."*

`docs/tickets/412/intent.md`:

```markdown
# 412 — Filter orders by status

Source: ticket 412 · Updated: 2026-10-27
Kind: feature · Lane: normal · Flags: spans several pages or modules, unclear requirements

## Request

Support staff want to narrow the /orders list to one status. Pending orders must "stand out",
which the ticket does not define.

## Goal

Support finds the orders that need action without scrolling the whole list.

## Current state

`src/pages/orders.astro` lists every order through `loadOrders` in
`src/components/orders/loadOrders.ts`. No filter exists.

## Scope

In:
- a status filter on /orders, kept in the URL
- a visual marker for pending orders

Out:
- filtering by customer or date (not asked)
- changing an order's status (ticket 418)
```

`docs/tickets/412/spec.md`:

```markdown
# 412 — Spec

Updated: 2026-10-27 · Intent: [intent.md](intent.md) · Plan: [plan.md](plan.md)

## Acceptance criteria

### AC1 — Filter by status
Given orders with statuses pending, paid and shipped
When the user picks "pending" in the status filter
Then only pending orders are listed and the URL is /orders?status=pending

### AC2 — Filter survives a reload
Given /orders?status=paid
When the page loads
Then the filter shows "paid" and only paid orders are listed

### AC3 — Pending stands out
Given a pending order in the list
When the list renders
Then its row shows a "Pending" badge in the warning style from DESIGN.md

## Edge cases

| Case | Expected | Source |
|------|----------|--------|
| No order has the chosen status | "No pending orders" with a link to clear the filter | inferred |
| `?status=unknown` | the filter falls back to "All" | inferred |

## Open questions

| # | Question | Blocks | Who can answer | Answer |
|---|----------|--------|----------------|--------|
| Q1 | Does "stand out" mean a badge, a row colour, or pending first? | AC3 | PO | |

## Assumptions

| # | Assumption | Source |
|---|------------|--------|
| A1 | The filter is a server-side URL param, not client state | develop-feature default |
```

`docs/tickets/412/plan.md`:

```markdown
# 412 — Plan

Updated: 2026-10-27 · Intent: [intent.md](intent.md) · Spec: [spec.md](spec.md)

## Modules

| Module / file | Kind | Covers | Notes |
|---------------|------|--------|-------|
| `src/components/orders/format.ts` | extend | AC1, AC2 | `parseStatus` with `Schema.is` |
| `src/pages/orders.astro` | extend | AC1, AC2 | reads `?status`, passes it to `loadOrders` |
| `src/components/orders/StatusFilter/index.tsx` | new | AC1 | island, `client:load` |
| `src/components/orders/StatusFilter/StatusFilter.stories.tsx` | new | AC1 | states: all, one selected |
| `src/components/orders/OrderRow/index.astro` | extend | AC3 | badge, pending Q1 |

## Build order

1. `format.ts` and its tests
2. `orders.astro` reading the param
3. `StatusFilter` island, story, test
4. `OrderRow` badge once Q1 is answered

## Not covered

AC3 waits for Q1.

## Test scenarios

| AC | Test | Level |
|----|------|-------|
| AC1 | choosing "pending" lists only pending rows | component |
| AC2 | rendering with `status=paid` shows paid rows and the filter value | page |
| AC3 | a pending row has the "Pending" badge | component |

Ready: AC1, AC2 · Blocked: AC3 (Q1) · Next: develop-feature
```
