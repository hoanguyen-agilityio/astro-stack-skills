# Inventory — the change and what already exists

Steps 1–2 of `review-code`. The review is only as good as this list: a duplicate is found by
comparing a new piece with one the reviewer knows exists.

## The change

The base is the branch the user named, else the default branch: `origin/HEAD` when there is a
remote, else whichever of `main` and `master` exists. Say in the report which one you used.

```bash
if default=$(git symbolic-ref --short -q refs/remotes/origin/HEAD); then :
elif git rev-parse --verify -q main >/dev/null; then default=main
else default=master
fi
base=$(git merge-base "${BASE:-$default}" HEAD)
git diff --name-only "$base"            # committed + uncommitted, tracked files
git ls-files --others --exclude-standard # new files not added yet
git diff "$base" --stat
```

Read every changed file in full. A diff hunk hides the imports, the props and the sibling code
that tell you whether the piece is new.

## What already exists

```bash
# Components, one folder each (index.astro / index.tsx)
find src/components -name 'index.astro' -o -name 'index.tsx' | sort

# Their props: the Props interface of .astro files, the props type of React ones
grep -n -A8 'interface Props\|type Props' -r src/components --include=index.astro --include=index.tsx

# Helpers and outcome helpers
ls src/components/*/format.ts src/components/*/load*.ts src/libs/*.ts 2>/dev/null
grep -n '^export' src/components/*/format.ts src/components/*/load*.ts src/libs/*.ts 2>/dev/null

# Services and Schema types
grep -n '^export' src/services/*.ts src/types/*.ts 2>/dev/null

# shadcn primitives already installed
ls src/components/ui/
```

Write the inventory as a short table the reviewer can scan:

| Piece | Where | What it does | Props / exports |
|-------|-------|--------------|-----------------|
| `LinkCard` | `common/LinkCard/index.astro` | card linking to a page, title + description | `href`, `title`, `description` |
| `formatPrice` | `orders/format.ts` | number → `"$12.50"` | `(cents: number) => string` |

Mark each piece that the change itself added, so the reviewer compares old against new and not
new against new.

## Where things belong

| Kind | Place | Imported by |
|------|-------|-------------|
| shadcn primitive | `src/components/ui/` | anything |
| used by two features or more | `src/components/common/<Name>/` | any feature, any page |
| app shell | `src/layouts/`, `src/components/layout/` | pages |
| one feature only | `src/components/<feature>/<Name>/` | that feature and its pages only |
| pure helper used by two features | `src/libs/<name>.ts` | anything |
