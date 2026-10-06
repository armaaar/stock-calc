# ADR-0016: Run the MCP server straight from GitHub

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0014](0014-mcp-server-interface.md) (how `.mcp.json` launches the server)

## Context

People should be able to use the MCP server without cloning the repository, and without publishing it to npm or the MCP Registry. npm can install a package straight from a git repository: `npx -y github:armaaar/stock-calc` clones it, installs its dependencies, and runs its `bin`. Three things stood in the way:

- **Portfolio files** were read from `src/data` next to the code. Once npx installs the code into its cache, users can't reasonably put files there.
- **No build step** ([ADR-0013](0013-node22-esm-toolchain.md)): the server is TypeScript run by `tsx`, which was only a dev dependency.
- **The `@/` alias:** tsx applies tsconfig `paths` only to files outside `node_modules`. An npx install lives inside `node_modules/stock-calc`, so every `@/…` import failed with `ERR_MODULE_NOT_FOUND`.

## Decision

- **Data folder:** the data drivers read portfolio files from `$STOCK_CALC_DATA_DIR` (a leading `~` means the home folder), falling back to `src/data` in the repository (`dataDirectory()` in `src/DataDrivers/DataFiles.reader.ts`).
- **Launcher:** `package.json` declares `"bin": { "stock-calc-mcp": "bin/stock-calc-mcp.js" }`, and `tsx` moves to `dependencies`. The launcher:
  - registers tsx with the package's own `tsconfig.json`, because npx starts the process in the user's folder,
  - registers `bin/alias-hooks.js`, a Node resolve hook that maps `@/x` to `src/x.ts`,
  - then imports `src/McpApp/app.ts`.

  The hook is registered after tsx, so it runs first and hands tsx a `.ts` file URL to compile.
- **Package contents:** a `files` list ships `bin`, `src` and `tsconfig.json`. It excludes tests, fixtures, nested CLAUDE.md files and personal `src/data/_*.jsonc` files, so a local `npm pack` can't leak portfolios.
- **`.mcp.json`** launches the same launcher (`node bin/stock-calc-mcp.js`), so the repository uses the path that users get.
- **Nothing is published.** The README documents `npx -y github:armaaar/stock-calc` (optionally pinned with `#<tag>`) and, for clones, `npx tsx --tsconfig <repo>/tsconfig.json <repo>/src/McpApp/app.ts`.

## Consequences

- One command, no clone, no registry account. Updates come from GitHub; pin a tag or commit for reproducibility.
- The first start is slow: npm installs the dependencies, and Puppeteer downloads Chrome.
- The `@/` alias is now defined in three places: tsconfig `paths` (tsc, tsx in the repo), `vitest.config.ts`, and `bin/alias-hooks.js` (installed copies). The hook assumes every `@/` import names a `.ts` file. Switching to Node subpath imports (`#src/*` in `package.json`) would unify them, at the cost of touching every import.
- Users need Node ≥ 22.12 and git. On Windows, some MCP clients need `cmd /c npx …`.
- Publishing to npm or the MCP Registry stays possible later; the `bin` entry and `files` list are already what a package needs.
