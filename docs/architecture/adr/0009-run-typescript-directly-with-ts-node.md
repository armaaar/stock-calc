# ADR-0009: Run TypeScript directly with ts-node (no build step)

- **Status:** Accepted
- **Date:** 2023-10-07
- **Introduced in:** `4d56948` (`cli` script on ts-node, `@/` paths), `c109258` (`ts-patch` + typia transform)

## Context

The tool is run locally by its author, always from the repository checkout. Building and distributing a compiled package adds steps with no benefit for this use. The code needs a path alias (`@/*` → `src/*`) and a TypeScript transformer for typia ([ADR-0007](0007-local-jsonc-portfolio-files.md)).

## Decision

- Run the CLI with `ts-node src/CliApp/app.ts` (`npm run cli`). `tsconfig.json` sets `noEmit: true`, so there is no `dist/`.
- Resolve the `@/` alias at runtime by registering `tsconfig-paths/register` in the `ts-node` section of `tsconfig.json`.
- Patch the installed TypeScript compiler with `ts-patch` in `postinstall`, so the `plugins: [{ transform: "typia/lib/transform" }]` entry in `tsconfig.json` is applied by both `ts-node` and `tsc`.

## Consequences

- No build step: edit, then run.
- `npx tsc` is a type-check only.
- Each invocation pays the TypeScript compile cost at startup.
- `npm install` must run its `postinstall` script. With `--ignore-scripts`, typia validators aren't generated and runtime validation breaks.
- Packaging as a global binary would require adding a build step and an emit configuration.
