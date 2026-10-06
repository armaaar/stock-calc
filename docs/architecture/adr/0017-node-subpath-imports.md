# ADR-0017: Resolve internal imports with Node subpath imports

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0016](0016-run-mcp-server-from-github.md) (drops `bin/alias-hooks.js`)

## Context

Imports across layers used the `@/*` → `src/*` alias. That alias is a TypeScript `paths` setting, which Node doesn't understand, so every tool that loads the code needed its own copy:

- `tsconfig.json` `paths`, read by tsc and by tsx inside the repository;
- `resolve.alias` in `vitest.config.ts`;
- `bin/alias-hooks.js`, a custom Node resolve hook, because tsx ignores `paths` for files inside `node_modules`, where `npx -y github:armaaar/stock-calc` installs the package.

The three had to agree. The hook was our own loader code, and it assumed every `@/` import named a `.ts` file. Any new tool would have needed a fourth copy.

## Decision

We will define the alias once, as a Node [subpath import](https://nodejs.org/api/packages.html#subpath-imports) in `package.json`:

```json
"imports": { "#src/*": "./src/*.ts" }
```

- Every `@/x` import becomes `#src/x`. Subpath imports must start with `#`, and Node 22 rejects `#/`, so the prefix is `#src/`.
- Node resolves it natively, in the repository and inside `node_modules` alike. tsc (`moduleResolution: bundler`), tsx and Vitest read the same field.
- `tsconfig.json` drops `paths`, `vitest.config.ts` drops its alias, and `bin/alias-hooks.js` is deleted.
- The launcher still registers tsx with the package's `tsconfig.json`, because that file carries `experimentalDecorators`, which class-validator needs.

## Consequences

- One definition, no custom loader. A new tool that follows Node resolution needs no configuration.
- Imports read `#src/...` rather than `@/...`. The change was a mechanical find-and-replace; nothing else in the code changed.
- The `.ts` extension lives in the mapping, so imports stay extensionless. Directory imports (`index.ts`) don't resolve through it; the project has none.
- `npx tsx --tsconfig <repo>/tsconfig.json <repo>/src/McpApp/app.ts` still needs `--tsconfig`, but only for the decorator settings now.
