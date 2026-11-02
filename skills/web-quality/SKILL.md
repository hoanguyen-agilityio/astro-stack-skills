---
name: web-quality
description: Audit and fix the pages of an Astro + React islands app for performance, Core Web Vitals, accessibility, SEO and security best practices, with evidence from the project's gates and, when available, a live browser. Use when asked about page speed, Lighthouse, Core Web Vitals, accessibility, SEO or security headers, or when pnpm test:pages fails.
argument-hint: "[routes, a branch, or an area: performance, a11y, seo, best-practices; default: every page]"
---

# Web quality — performance, accessibility, SEO, best practices

Use this skill when the user asks to audit or improve a page or the whole site ("audit my site",
"improve SEO", "speed up this page", "fix layout shift", "a11y audit", "security headers"), or
when `review-code` reaches its web-quality category. It works on what the `code-skeleton` stack
ships: `BaseLayout` metadata, `src/middleware.ts` headers, the CSP from `experimental.csp`,
`robots.txt` and `sitemap.xml` routes, and the `test:pages` and `test:stories` gates.

Adapted for this stack from [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills)
(MIT): the same evidence-first approach, rewritten around Astro islands and this repo's gates.
Accessibility is not rewritten here: the general WCAG review comes from that pack's own
`accessibility` skill, used as it is (step 4), so nobody on our side maintains a copy of it.

```
scope ─► gates (test:pages, test:stories) ─► source review per area ─► accessibility skill ─► live evidence? ─► findings ─► fix, loop ≤ 3 ─► report
```

## Inputs

| Input | Default |
|-------|---------|
| Scope | Every route `test:pages` crawls; or the routes, branch or area the user names. `a11y` alone runs steps 1, 2 (`test:stories` only) and 4 |
| Mode | **loop** (fix and re-check) when asked to improve; **report** when asked only to audit |
| Live target | `pnpm preview` locally. A staging URL only when the user gives it |

## Workflow

1. **Look first.** Read `package.json` (scripts `test:pages`, `test:stories`), `DESIGN.md`
   (Performance budget, tokens), `astro.config.mjs` (`site`, `experimental.csp`),
   `src/middleware.ts`, `src/layouts/BaseLayout.astro` and the pages in scope. A project from an
   older skeleton may miss some of these: list what is missing as findings, and add it the way
   `code-skeleton`'s `references/project-files.md` shows only in loop mode.
2. **Run the gates.** `pnpm build`, `pnpm test:pages`, `pnpm test:stories`. Each failure is a
   finding with **measured** evidence (the gate's output line).
3. **Review the source per area**, with the reference for each: what the gates cannot see
   (LCP image priority, island directives, heading order, link text, focus, motion, forms,
   third-party scripts). Findings from source alone are **hypotheses**: say which command or
   browser check would confirm each one.
   → `references/performance.md`, `references/accessibility.md` (stack points only),
   `references/seo.md`, `references/best-practices.md`
4. **Accessibility (external skill).** Only when the scope has `.astro`, `.tsx`, `.jsx` or
   `.css` files.
   1. Check that the skill is installed: `ls .claude/skills/accessibility/SKILL.md
      ~/.claude/skills/accessibility/SKILL.md`.
   2. Installed: call the `accessibility` skill with the Skill tool, scoped to those files. Use
      its WCAG review against the source; leave its Lighthouse and browser steps to step 5.
      Its findings join the others with the severities below.
   3. Missing: install nothing. Tell the user once, then carry on with the rest:
      > The `accessibility` skill is not installed, so the WCAG review was skipped. Install it
      > with `npx skills add addyosmani/web-quality-skills --skill accessibility`, or copy
      > `skills/accessibility` from github.com/addyosmani/web-quality-skills into
      > `.claude/skills/accessibility/`.

      Write "a11y not checked (skill missing)" under Not verified in the report. `test:stories`
      still ran axe on every story, so say that too.
5. **Live evidence, when a browser tool is available** (Chrome DevTools MCP, Lighthouse CLI,
   or the built-in browser) and only against `pnpm preview` or a URL the user gave. Record a
   performance trace for LCP, CLS and the slowest interaction; run Lighthouse for the
   non-performance categories. A Lighthouse score is a summary, not proof: report the failing
   audits, never "score 100" as done. Never treat a lab number as field data (CrUX, RUM).
6. **Findings.** One row each, with the severity `review-code` uses:

   | Severity | Means |
   |----------|-------|
   | `blocker` | A failing gate; a missing security header or CSP; a page that cannot be used with the keyboard; content invisible to search (noindex on a public page, broken canonical) |
   | `should` | A measured budget or Core Web Vitals problem; a source hypothesis with a clear fix (LCP image lazy, `client:load` without reason, image without size) |
   | `nit` | Wording of titles and descriptions, link text, small optimisations |

7. **Fix and loop** (loop mode). Fix every `blocker` and `should` in the source, then run the
   gates again and re-check what the fix touched. Stop when a round has none left, or after
   **3 rounds**; what is left is reported with why. Never weaken a gate: no budget raised, no
   path added to `IGNORED_PATHS`, no CSP loosened with `'unsafe-inline'`, no rule switched off,
   to get green. A budget that is wrong for the product is a question for the user.
8. **Report.** The `## Result` block, then:

   ```markdown
   ### Web quality
   | # | Severity | Area | Where | Finding | Evidence | Status |
   |---|----------|------|-------|---------|----------|--------|
   | 1 | blocker | best-practices | src/middleware.ts | no X-Frame-Options | measured: test:pages | fixed |
   | 2 | should | performance | pages/index.astro:12 | hero image is lazy (LCP) | hypothesis: confirm with a trace | fixed |

   Gates after the last round: build, test:pages (6 pages, 0 problems), test:stories (44/44) — pass
   Accessibility: `accessibility` skill on 4 changed files, 2 findings (rows 3–4)
   Not verified here: field Core Web Vitals (CrUX/RUM), screen reader pass, 200% zoom
   ```

## Done when

- `pnpm test:pages` and `pnpm test:stories` pass, and no `blocker` or `should` is left, or the
  report lists what is left and why.
- Every finding says whether it was measured or is a hypothesis, and how to confirm it.
- The `accessibility` skill reviewed the UI files in scope, or the report says
  "a11y not checked (skill missing)" with the install command.
- The report names the checks only a person can do (screen reader, zoom, real devices) as not
  verified, instead of claiming them.

## Common failure modes

- Treating a Lighthouse score or a passing axe run as WCAG conformance or a ranking promise
- Reporting a source guess as a measured regression
- Fixing a CSP error with `'unsafe-inline'` instead of `Astro.csp.insertScriptHash` or moving
  the script into a bundled `<script>`
- Preloading or `fetchpriority="high"` on several images: only the LCP image gets it
- Giving every page the default description, so `test:pages` fails on duplicates
- Adding `noindex` to silence a duplicate-title failure on a public page
- Copying WCAG rules into this repo, or installing the `accessibility` skill without asking:
  use it where it is installed, and tell the user how to install it when it is not

## References

| File | Use |
|------|-----|
| `references/performance.md` | Budgets, LCP/CLS/INP for Astro islands, images, fonts, prefetch, caching |
| `references/accessibility.md` | Only what is specific to this stack (axe in `test:stories`, `AppLayout` landmarks, shadcn focus and forms); the WCAG review itself is the external `accessibility` skill |
| `references/seo.md` | `BaseLayout` metadata, canonical, Open Graph, robots, sitemap, headings, links, JSON-LD |
| `references/best-practices.md` | Security headers, CSP with Astro, third-party scripts, console errors, source maps, dependencies |
