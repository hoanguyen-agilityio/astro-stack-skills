# The release pull requests

Three pull requests carry a release. A release manager approves the first two. The release gate
checks each approval on the pull request's **head commit**, so a commit pushed after an approval
needs a new one.

| Pull request | From → into | Title | What it changes |
|---|---|---|---|
| Stage | `release/<version>` → `stag` | `Stage <version>` | dev's changes, plus `package.json` → `version` and `CHANGELOG.md` |
| Release | `stag` → `prod` | `Release <version>` | exactly what staging runs and was checked |
| Back-merge | `prod` → `dev` | `Back-merge <version>` | the version and the CHANGELOG back to dev |

The release title must be exactly `Release <version>`: the gate reads the version from it.

## Stage body

```markdown
## Stage 1.4.0

**From:** release/1.4.0, cut from dev at 4f2c9e1 · **Head:** 7a1d3b0 (version + CHANGELOG)
Approving lets this exact commit reach staging; production needs a second pull request.

### Changes
<the CHANGELOG section>

### Checklist on 7a1d3b0
| Check | Result |
|---|---|
| lint, format, typecheck | pass |
| test:coverage | pass (lines 86%) |
| build | pass |
| test:stories | pass (48 stories, light and dark, a11y clean) |
| test:pages | pass (12 pages) |
| Environment variables in staging and production (names only) | all 3 set: PUBLIC_API_URL, PUBLIC_SENTRY_DSN, SESSION_SECRET |

### Not verified
<what nobody checked: from the merged PRs' "Not verified" lines and this release>

### On approval
/release merges this pull request; GitHub Actions deploys staging (https://stag.example.com);
/release then runs the staging checks and opens "Release 1.4.0" from stag into prod.

Approvers: @ni-ngo (release manager). Approve only if you own this release.
```

## Release body

```markdown
## Release 1.4.0

**From:** stag at 9c0e5f2 (merge of #55) · **Into:** prod → https://example.com
Approving approves exactly 9c0e5f2. A commit pushed after the approval needs a new one.

### Changes
<the CHANGELOG section>

### Staging (https://stag.example.com, deploy run <link>)
| Check | Result |
|---|---|
| Headers, robots.txt and 404 on staging | pass (CSP, nosniff, referrer, frame, HSTS) |
| Changed pages: console, requests, metadata, API data | pass (3 pages) |
| Smoke flow: order history, filter by status | pass (Claude in Chrome) |
| Confirmed by QA | @qa-name, 2026-11-02 |

### Not verified
<what staging did not cover>

### On approval
/release merges this pull request with a merge commit; GitHub Actions deploys production
(and waits for the `production` environment's reviewers, if set); /release then tags v1.4.0 on
that merge commit and opens the back-merge into dev.

Approvers: @ni-ngo (release manager). Approve only if you own this release.
```

## Back-merge body

```markdown
## Back-merge 1.4.0

Brings `package.json` 1.4.0 and the CHANGELOG section from prod back to dev after the release
(tag v1.4.0 at <sha>). No other change. Merge with a merge commit.
```
