# SEO in this stack

Technical SEO is mostly decided once, in `BaseLayout.astro` and two routes, and then kept by
`pnpm test:pages`. Content quality and ranking are not something a skill can promise: never
report a ranking or traffic change as a result of a fix.

## What the gate checks

`pnpm test:pages` crawls every page linked from `/` and listed in `sitemap.xml`, and fails on:
an empty `<title>`, a missing meta description, a title or description used by two indexable
pages, a missing or wrong canonical, no `<h1>`, `<html>` without `lang`, no responsive viewport,
`robots.txt` without a `Sitemap` line, a sitemap page that is `noindex`, and a missing page that
does not answer 404 with `noindex`.

## Per page: what a page passes to its layout

```astro
<AppLayout
  title="Orders"
  description="Confirm or cancel today's lunch orders, filtered by status."
>
```

- `title`: what the page is, in a few words. `BaseLayout` appends the site name.
- `description`: one or two sentences about this page. It is required by `AppLayout`, so a page
  cannot fall back to the site's description and duplicate it.
- `noindex`: on pages that should not be in search: error pages, signed-in screens, drafts,
  and anything behind a login. Not on a public page to hide a duplicate.
- `image`: a social preview for pages that get shared; a file in `public/` or an absolute URL.

`BaseLayout` writes from these: `<title>`, the description, a canonical URL (the page's path on
`site`, without the query string, so `/orders?status=paid` points to `/orders`), Open Graph and
Twitter card tags, and `robots` when `noindex`.

## Site level

- `site` in `astro.config.mjs` comes from `PUBLIC_SITE_URL`. Set it per environment: a
  canonical or sitemap pointing at `localhost` in production is a `blocker`.
- `src/pages/robots.txt.ts` allows everything and points at the sitemap. Add `Disallow:` only
  for areas that must stay out (an `/admin`), never for `/_astro/` (CSS and JS search engines
  need to render).
- `src/pages/sitemap.xml.ts` lists `siteConfig.nav`. A public page that is not in the
  navigation is added to the sitemap by hand; a `noindex` page never is.
- Staging: set `noindex` on every page (for example from an env flag in `BaseLayout`) or protect
  it with a login, so it never competes with production.

## Content and structure (review, not gate)

- One clear `<h1>` saying what the page is; headings in order.
- Link text says where it goes: "View today's orders", not "Click here".
- URLs are short, lowercase, words joined by hyphens; filters are query parameters.
- Images that carry meaning have `alt` (the gate checks presence; wording is a review point).

## Structured data

Add JSON-LD only for what the page really shows (an `Organization` on the home page, a `Product`
on a product page), and only when the user asks for rich results. It is data, not a script, so
the CSP does not block it:

```astro
---
const data = { '@context': 'https://schema.org', '@type': 'Organization', name: siteConfig.name, url: Astro.site?.href };
---
<script type="application/ld+json" set:html={JSON.stringify(data)} />
```

Validate it with Google's Rich Results Test; passing it does not guarantee a rich result.

## Out of scope by default

- `llms.txt`, AI crawler rules in `robots.txt`, `hreflang` for several languages: only when the
  user asks, and per crawler (blocking a training crawler is not the same as blocking a search
  crawler).
- Search Console, rank tracking, keyword research.
