# Checking staging

Staging runs the exact commit the release pull request will ship, so it is where the release
is proven before the second approval. Check it after the deploy run on `stag` has finished green
for the head of `stag` (`release-status.mjs` → `staging.runs`).

## 1. The page checks, against staging

`pnpm test:pages` already passed on the built site (Phase 3). What it cannot see is what the
host changes: headers it adds or strips, variables it sets, and the real API. Check those on
staging:

```bash
curl -sI https://stag.example.com/ | grep -iE '^(content-security-policy|x-content-type-options|referrer-policy|x-frame-options|strict-transport-security):'
curl -s https://stag.example.com/robots.txt
curl -s -o /dev/null -w '%{http_code}\n' https://stag.example.com/no-such-page
```

Then open each changed page (with Claude in Chrome when it is connected) and look at the console,
the failed requests, the title and description, and whether the API data loads. A difference from
the local run comes from the environment, such as a missing variable, a header or the API URL.
Say which.

## 2. The smoke flow

For each item in the CHANGELOG section, walk through it on staging: open the page, use the
feature and look at the result. Use Claude in Chrome when it is connected, otherwise list the steps
for the dev. Write one line per item: what was done and what was seen, plus a screenshot when it helps.

Do not sign in with real users' accounts, and do not create orders, payments or messages that
reach real people. Use the test accounts and data the team keeps for staging, and ask the dev for
them. Never enter a password yourself.

## 3. What a person confirms

Ask the dev, or the QA they name, to confirm what a check cannot judge: copy, layout on their
devices, and flows with real data. Record who confirmed what, with the date, for the release
pull request.

## A failure

Do not fix it on `stag` or `release/<version>`. Fix it on dev through its own pull request,
then cut the release again (Phase 4): the stage approval and the staging checks start over.
