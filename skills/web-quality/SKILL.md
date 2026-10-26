---
name: web-quality
description: Audit and fix the pages of an Astro + React islands app for performance, Core Web Vitals, accessibility, SEO and security best practices, with evidence from the project's gates and, when available, a live browser.
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

```
scope ─► gates (test:pages, test:stories) ─► source review per area ─► live evidence? ─► findings ─► fix, loop ≤ 3 ─► report
```

## Inputs

| Input | Default |
|-------|---------|
| Scope | Every route `test:pages` crawls; or the routes, branch or area the user names |
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
   → `references/performance.md`, `references/accessibility.md`, `references/seo.md`,
   `references/best-practices.md`
4. **Live evidence, when a browser tool is available** (Chrome DevTools MCP, Lighthouse CLI,
   or the built-in browser) and only against `pnpm preview` or a URL the user gave. Record a
   performance trace for LCP, CLS and the slowest interaction; run Lighthouse for the
   non-performance categories. A Lighthouse score is a summary, not proof: report the failing
   audits, never "score 100" as done. Never treat a lab number as field data (CrUX, RUM).
5. **Findings.** One row each, with the severity `review-code` uses:

   | Severity | Means |
   |----------|-------|
   | `blocker` | A failing gate; a missing security header or CSP; a page that cannot be used with the keyboard; content invisible to search (noindex on a public page, broken canonical) |
   | `should` | A measured budget or Core Web Vitals problem; a source hypothesis with a clear fix (LCP image lazy, `client:load` without reason, image without size) |
   | `nit` | Wording of titles and descriptions, link text, small optimisations |

6. **Fix and loop** (loop mode). Fix every `blocker` and `should` in the source, then run the
   gates again and re-check what the fix touched. Stop when a round has none left, or after
   **3 rounds**; what is left is reported with why. Never weaken a gate: no budget raised, no
   path added to `IGNORED_PATHS`, no CSP loosened with `'unsafe-inline'`, no rule switched off,
   to get green. A budget that is wrong for the product is a question for the user.
7. **Report.** The `## Result` block, then:

   ```markdown
   ### Web quality
   | # | Severity | Area | Where | Finding | Evidence | Status |
   |---|----------|------|-------|---------|----------|--------|
   | 1 | blocker | best-practices | src/middleware.ts | no X-Frame-Options | measured: test:pages | fixed |
   | 2 | should | performance | pages/index.astro:12 | hero image is lazy (LCP) | hypothesis: confirm with a trace | fixed |

   Gates after the last round: build, test:pages (6 pages, 0 problems), test:stories (44/44) — pass
   Not verified here: field Core Web Vitals (CrUX/RUM), screen reader pass, 200% zoom
   ```

## Done when

- `pnpm test:pages` and `pnpm test:stories` pass, and no `blocker` or `should` is left, or the
  report lists what is left and why.
- Every finding says whether it was measured or is a hypothesis, and how to confirm it.
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

## References

| File | Use |
|------|-----|
| `references/performance.md` | Budgets, LCP/CLS/INP for Astro islands, images, fonts, prefetch, caching |
| `references/accessibility.md` | Page-level checks beyond axe: keyboard, focus, target size, motion, forms, live regions, manual checks |
| `references/seo.md` | `BaseLayout` metadata, canonical, Open Graph, robots, sitemap, headings, links, JSON-LD |
| `references/best-practices.md` | Security headers, CSP with Astro, third-party scripts, console errors, source maps, dependencies |
