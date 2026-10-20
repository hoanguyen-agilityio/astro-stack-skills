# astro-stack-skills

Claude Code marketplace `astro-stack`. It holds one plugin, `web-dev-stack`: project-agnostic
skills for one stack, **Astro** · **React** (islands) · **TypeScript** (strict) · **Effect** (with
Schema) · **oRPC** · **shadcn/ui**.

## Install

```bash
claude plugin marketplace add git@gitlab.asoft-python.com:hoa.nguyen/astro-stack-skills.git
claude plugin install web-dev-stack@astro-stack
```

To try local changes without installing, start Claude Code with `claude --plugin-dir <path to this repo>`.

## Layout

```
.claude-plugin/
├── marketplace.json   # marketplace "astro-stack", lists the plugin at ./
└── plugin.json        # plugin "web-dev-stack"
skills/
└── code-skeleton/     # SKILL.md + references/project-files.md
```

## Skills

| # | Skill | Status | Use it when |
|---|-------|--------|-------------|
| 1 | `code-skeleton` | ready | Starting a project, or bringing an Astro repo up to the stack |
| 2 | `integrate-api` | planned | Calling oRPC procedures through Effect services |
| 3 | `develop-feature` | planned | Building a ticket into a tested page or island |

### `code-skeleton`

Produces a project that passes `lint`, `typecheck`, `test` and `build` before any feature code
exists. It includes:

- Astro with React islands and an SSR adapter
- strict TypeScript and the `@/` alias
- Effect and oRPC installed, with `src/libs/orpcClient.ts` pointing at `PUBLIC_API_URL`
- shadcn/ui on Tailwind v4
- ESLint, which bans `any` and `@ts-ignore`
- Vitest with Testing Library, plus a smoke island and its test

```text
/web-dev-stack:code-skeleton Create project lunch-order, oRPC pointing to http://localhost:8787/rpc
```

Verified on Astro 5, Effect 3, oRPC 1, Tailwind 4, Vite 6, Vitest 3 and shadcn CLI 4. Requires
Node ≥ 22.12. The skill's Step 1 table lists the full set.

## Conventions shared by all skills

| What | Where |
|------|-------|
| oRPC client factory and procedure types | `src/libs/orpcClient.ts` |
| Services (one per API namespace, return `Effect`) | `src/services/<name>.ts` |
| shadcn primitives | `src/components/ui/` |

- Read `package.json` first and match the project's Astro, Effect, Tailwind and oRPC versions.
- No `any` and no `@ts-ignore`. API data is decoded with `Schema` before use.
- All skills share one running example, `orders`.
