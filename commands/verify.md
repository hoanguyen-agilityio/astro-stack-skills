---
description: Run every gate in a loop (fix, re-run from lint) until all pass, then review the change with review-code.
argument-hint: "[--no-review] [anything to focus on]"
---

# Verify — gates in a loop, then review

Check the current change the way the build skills end: run the gates, fix what fails, run them
again, then review. Extra focus from the user: $ARGUMENTS

## Gates

Read `package.json` and run, in this order, each of these scripts it has:

1. `pnpm lint`
2. `pnpm format:check`
3. `pnpm typecheck`
4. `pnpm test:coverage` (or `pnpm test` when there is no `test:coverage`)
5. `pnpm build`
6. `pnpm test:stories` (every story in light and dark: render, `play`, a11y)
7. `pnpm test:pages` (every page: SEO metadata, security headers and CSP, console errors,
   broken links, images, JS/CSS budget)

Run them as `pnpm lint && pnpm format:check && …` so pnpm's output shows which one failed. A
missing script is skipped and named in the report; never add one here.

## Loop

1. Run the gates. All pass: go to Review.
2. A gate fails: read its output, fix the cause in the code, then start again at step 1 from
   `pnpm lint` (a fix can break an earlier gate).
3. Stop after **5 runs** of the gates, or when the same failure comes back after a fix. Report
   it as left, with the output and what you tried. A human decides from there.

Never weaken a gate to get green: no lowered coverage threshold, no disabled ESLint rule, no
`any` or `@ts-ignore`, no `!test` tag on a story, no a11y rule turned off in `parameters.a11y`,
no `--no-verify`, no path added to `IGNORED_PATHS`, no raised budget, no `'unsafe-inline'` in
the CSP. `test:stories` or `test:pages` stops with `Executable doesn't exist`: Chromium is
missing; ask the user to run `pnpm exec playwright install chromium` instead of skipping the
gate.

## Review

Unless the arguments say `--no-review`, run the `review-code` skill on the change once the gates
pass. It has its own loop (at most 3 rounds) and re-runs the gates after its fixes.

## Report

End with a `## Result` block (Did, Saw, Not done, Blocked by, Next), then:

- the gate runs: how many, and the last output line of each gate;
- the review table from `review-code`, or "skipped (--no-review)";
- anything left, and why.
