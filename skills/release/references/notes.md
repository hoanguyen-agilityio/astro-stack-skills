# Release notes and the changelog

The dev owns the wording; you draft.

## Where the changes come from

`release-status.mjs` → `changes.toStaging`: the commits on dev that are not on stag yet, with the
ticket ids in their subjects. For each merged pull request, read its description when a title is
not enough to say what changed for users (`gh pr view <n> --json body`, the MCP server, or the
page). `docs/tickets/<id>/intent.md` says what a ticket asked for. Do not invent features from
commit names.

Leave out what users never see (refactors, tests, CI, dependency bumps with no visible effect),
unless it fixes something they noticed.

## CHANGELOG.md

The team's record, newest first, one section per release, in English. Ticket ids stay, linked
when the board's URL pattern is known. The format is [Keep a Changelog](https://keepachangelog.com/).

```markdown
## 1.4.0 — 2026-11-03

Release PR #57 · staged in #55

### Added
- Order history page with filters by status (SHOP-15)

### Changed
- The cart shows the delivery fee before checkout (SHOP-12)

### Fixed
- Cart badge count after removing an item (SHOP-31)
```

- Use the date the release reaches production. Write the planned date on the stage PR, and
  correct it on `release/<version>` if it moves.
- Leave out empty groups.
- A hotfix gets its own section (`## 1.4.1 — …`) with only `### Fixed`.
- On the first release, create the file with one intro line: `All notable changes to this app.`
