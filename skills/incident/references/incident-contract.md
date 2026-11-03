# Incident contract — `report.md`, `rca.md`, `actions.md`

Every incident is written up as three files in one folder:

```
docs/incidents/<id>/
├── report.md    what happened: status, severity, summary, impact, timeline, detection
├── rca.md       why: trigger, root cause with evidence, contributing factors, why it was not caught
└── actions.md   what we do about it: mitigation, fix, prevention actions with owners, lessons
```

The team reads these in a merge request, and later incidents are compared with them, so their
shape is fixed. A file that breaks the contract is fixed before it is committed.

## Folder name

- The user gave an incident id (`INC-12`, `#12`): use it, with only letters, digits, `.`, `_`,
  `-`: `#12` → `12`.
- No id: `<YYYY-MM-DD>-<slug>`, the date the incident **started** and a short kebab-case slug of
  what broke: `2026-10-26-orders-500`. When the start date is unknown, use today's date and say
  so in **Open questions**.
- One folder per incident. Running `/incident` again for it **updates** the three files in
  place.

## Rules for all three files

1. Every heading below is present, with the exact text, in the order shown. A section that does
   not apply, or is not known yet, says `None.` or `Unknown: see Q<n>.` and is never deleted.
   Add no other `##` headings.
2. The header lines are exactly as in the template. `Updated:` is the date of the last change.
3. **Blameless.** Describe systems, changes and decisions, never a person's fault. People appear
   only as the owner of an action.
4. **Facts or hypotheses.** Every statement about cause in `rca.md` cites its evidence (a commit
   SHA, `file:line`, a log line, a metric, an MR) or starts with `Hypothesis:`. A hypothesis is
   never written as a fact.
5. **One time zone.** Times are `YYYY-MM-DD HH:MM` in the zone named in `report.md`'s header.
6. **No secrets or personal data.** Logs often hold tokens, cookies, emails, phone numbers, IPs
   and order contents. Never copy them: write `<redacted: token>`, `<redacted: email>`. Internal
   URLs become `<from env: NAME>` or a description.
7. IDs are stable: `Q1…` and `P1…` keep their number across updates.

### Status and severity

| Status | Meaning |
|--------|---------|
| `investigating` | still happening, cause not known |
| `mitigated` | impact stopped, permanent fix not shipped |
| `resolved` | permanent fix shipped and checked |

| Severity | Meaning |
|----------|---------|
| `SEV1` | most users blocked, data lost or exposed, or a security breach |
| `SEV2` | one major feature down or wrong for many users, no workaround |
| `SEV3` | partial or minor impact, or a workaround exists |

A project's `AGENTS.md` (or `CLAUDE.md`) may define its own severities; then use those.

## `report.md`

```markdown
# <id> — <what broke, in a few words>

Status: investigating | mitigated | resolved · Severity: SEV1 | SEV2 | SEV3 · Updated: <YYYY-MM-DD>
Started: <time or Unknown> · Detected: <time> · Mitigated: <time or —> · Resolved: <time or —> · Time zone: <UTC+07:00>

## Summary

<Two or three plain sentences: what users saw, for how long, and what stopped it.>

## Impact

<Who and what was affected, how many, for how long. Every number names its source (a metric,
a log query, a support count). Unknown numbers point to an open question.>

## Timeline

| Time | Event | Source |
|------|-------|--------|
| 2026-10-26 09:12 | <event> | <deploy log / alert / support ticket / commit> |

## Detection

<How it was noticed (alert, user report, a developer), and how long after it started. If it
was not an alert, say which alert would have caught it.>
```

## `rca.md`

```markdown
# <id> — Root cause

Updated: <YYYY-MM-DD> · Report: [report.md](report.md) · Actions: [actions.md](actions.md)

## Trigger

<What changed or happened right before: a deploy, a config change, traffic, a provider outage.
With its evidence.>

## Root cause

<The underlying cause, reached by asking "why" until the answer is something the team can
change. Each step cites evidence or is a `Hypothesis:`.>

## Contributing factors

<What made it worse or longer: missing retry, no feature flag, slow rollback. "None." if none.>

## Why it was not caught

<Which test, review, type, gate or alert could have stopped it before users saw it, and why
it did not.>

## Open questions

| # | Question | Who can answer | Answer |
|---|----------|----------------|--------|
| Q1 | <question> | <backend / ops / PO / user> | <empty until answered> |
```

## `actions.md`

```markdown
# <id> — Actions

Updated: <YYYY-MM-DD> · Report: [report.md](report.md) · Root cause: [rca.md](rca.md)

## Mitigation

<What stopped the impact, when, and whether it is still in place (a rollback, a flag, a
manual fix). "None yet." while investigating.>

## Fix

<The permanent fix: its MR or commit, or "Not started" with the ticket that will carry it.>

## Prevention

| # | Action | Type | Owner | Due | Ticket | Status |
|---|--------|------|-------|-----|--------|--------|
| P1 | <action that stops this class of incident> | test / alert / code / process | <name or "unassigned"> | <date or —> | <id or —> | open / done |

## Lessons

<What the team learned that is not an action: one to three bullets.>

Open actions: <n> · Fix: <MR / commit / pending>
```

Every prevention action answers a line of **Why it was not caught** or **Contributing factors**.
An action with no owner says `unassigned`; never invent one.

## Contract check

Run before committing and fix every failure:

```bash
for f in report rca actions; do echo "== $f"; grep -n '^## ' "docs/incidents/<id>/$f.md"; done
```

| File | `##` headings, in this order |
|------|------------------------------|
| `report.md` | Summary, Impact, Timeline, Detection |
| `rca.md` | Trigger, Root cause, Contributing factors, Why it was not caught, Open questions |
| `actions.md` | Mitigation, Fix, Prevention, Lessons |

Then check by reading: the header lines, every cause in `rca.md` has evidence or `Hypothesis:`,
no secret or personal data from the logs, every prevention action has a type and an owner (or
`unassigned`), and `actions.md` ends with the `Open actions` line.

## Example — 2026-10-26-orders-500

Input: *"/orders returned 500 for everyone from about 09:10 to 09:40 this morning. We rolled back
to the previous build and it came back."* with a log line
`ParseError: Expected "pending" | "paid" | "shipped", actual "refunded"` at
`src/services/orders.ts`.

`docs/incidents/2026-10-26-orders-500/report.md`:

```markdown
# 2026-10-26-orders-500 — /orders returned 500

Status: mitigated · Severity: SEV2 · Updated: 2026-10-26
Started: 2026-10-26 09:10 · Detected: 2026-10-26 09:18 · Mitigated: 2026-10-26 09:40 · Resolved: — · Time zone: UTC+07:00

## Summary

The /orders page returned a server error for every user for about 30 minutes. Rolling back to
the previous build restored it.

## Impact

Every request to /orders failed from 09:10 to 09:40. How many users opened it is unknown: see Q1.
Other pages worked.

## Timeline

| Time | Event | Source |
|------|-------|--------|
| 2026-10-26 09:10 | First 500 on /orders | user report |
| 2026-10-26 09:18 | Support reports "orders page broken" | support chat |
| 2026-10-26 09:40 | Previous build redeployed, /orders works | user report |

## Detection

Support noticed it, 8 minutes after it started. No alert fired: an alert on the 5xx rate of
/orders would have caught it within a minute.
```

`docs/incidents/2026-10-26-orders-500/rca.md`:

```markdown
# 2026-10-26-orders-500 — Root cause

Updated: 2026-10-26 · Report: [report.md](report.md) · Actions: [actions.md](actions.md)

## Trigger

Hypothesis: the backend started returning orders with status `refunded` this morning. The log
line shows `actual "refunded"`; when that status first appeared is not known (Q2).

## Root cause

`OrderStatus` in `src/types/orders.ts:4` accepts only `pending`, `paid` and `shipped`, so
decoding a `refunded` order fails (log: `ParseError: Expected "pending" | "paid" | "shipped",
actual "refunded"`). `loadOrders` in `src/components/orders/loadOrders.ts:12` turns every
decode error into a thrown error instead of an error state, so one unknown status breaks the
whole page.

## Contributing factors

The API has no published contract for order statuses, so the frontend schema is a copy.

## Why it was not caught

The service tests in `src/services/__test__/orders.test.ts` only use known statuses. No test
covers a status the schema does not know.

## Open questions

| # | Question | Who can answer | Answer |
|---|----------|----------------|--------|
| Q1 | How many users opened /orders between 09:10 and 09:40? | ops | |
| Q2 | When did the backend start returning `refunded`? | backend | |
```

`docs/incidents/2026-10-26-orders-500/actions.md`:

```markdown
# 2026-10-26-orders-500 — Actions

Updated: 2026-10-26 · Report: [report.md](report.md) · Root cause: [rca.md](rca.md)

## Mitigation

Rolled back to the previous build at 09:40. Still in place.

## Fix

Not started: ticket 431 adds `refunded` to `OrderStatus` and shows it in the list.

## Prevention

| # | Action | Type | Owner | Due | Ticket | Status |
|---|--------|------|-------|-----|--------|--------|
| P1 | `loadOrders` returns an error state for a decode error instead of throwing | code | unassigned | — | 431 | open |
| P2 | A service test with an unknown status | test | unassigned | — | 431 | open |
| P3 | Alert on the 5xx rate of /orders | alert | unassigned | — | — | open |

## Lessons

- A copied enum drifts from the API; the schema needs an owner on both sides.

Open actions: 3 · Fix: pending
```
