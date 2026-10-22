# Reviewer prompt, findings format and report

## The subagent prompt

Start one subagent per round (Agent tool, general-purpose). Fill the `<…>` parts; paste the
checklist, the inventory table and the check output as they are. The subagent cannot see the
plugin's files, so the checklist goes into the prompt, not as a path.

```text
You review a change in an Astro 5 + React 19 + Effect 3 + oRPC project. You did not write it.
Assume nothing is right until you have checked it.

Read first: CLAUDE.md and DESIGN.md in the project root.

Review checklist:
<contents of references/checklist.md>

Changed files (read each in full): <list>
Existing pieces (inventory): <table>
Check output (pnpm dup and the gates): <output, or "all passed">
Acceptance criteria: <list, or "none given">
Findings already fixed in earlier rounds: <list, or "none">

For every changed file, go through each checklist category. For a duplicate, open the existing
piece and compare props and markup before you call it one.

Return only findings, in this format, most severe first. Return "No findings." if there are none.

- [blocker|should|nit] <category>: <file>:<line> — <what is wrong>
  Evidence: <existing piece path / rule source / failing input>
  Fix: <the change to make>

Do not edit files.
```

Categories: `duplicate`, `convention`, `criteria`, `bug`, `check`, `nit`.

## Example findings

```text
- [blocker] duplicate: src/components/products/ProductLink/index.astro:1 — same role and markup as common/LinkCard (title, description, link), props differ only by name
  Evidence: src/components/common/LinkCard/index.astro (href, title, description)
  Fix: render <LinkCard href title description /> in ProductList and delete ProductLink
- [should] convention: src/components/products/ProductList/index.astro:14 — text-[#666]
  Evidence: DESIGN.md tokens (text-muted-foreground)
  Fix: use text-muted-foreground
- [nit] nit: src/components/products/format.ts:3 — formatP is unclear
  Fix: rename to formatProductPrice
```

## The report

After the last round, add this to the build skill's `## Result` (or report it alone):

```markdown
### Review (review-code)

Rounds: 2 of 3 · stopped: no blocker or should left

| # | Severity | Category | Where | Finding | Status |
|---|----------|----------|-------|---------|--------|
| 1 | blocker | duplicate | products/ProductLink | copy of common/LinkCard | fixed: uses LinkCard, ProductLink deleted |
| 2 | should | convention | products/ProductList:14 | raw hex colour | fixed: text-muted-foreground |
| 3 | nit | nit | products/format.ts:3 | unclear name `formatP` | left |

Checks after the last round: pnpm dup — no clones · lint, format:check, typecheck, test:coverage (91%), build — pass
```

A finding left after 3 rounds, or one the fix could not clear, is listed with `left` and the
reason, so the user decides.
