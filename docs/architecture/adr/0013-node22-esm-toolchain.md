# ADR-0013: Node 22 native ESM toolchain with tsx

- **Status:** Accepted
- **Date:** 2026-10-06
- **Supersedes:** [ADR-0009](0009-run-typescript-directly-with-ts-node.md)

## Context

All dependencies were upgraded to their latest versions. That changed the constraints:

- `commander` 15, `puppeteer` 25, `chalk` 6, `vitest` 5 and `ts-patch` 4 need Node ≥ 22.12, and `@modelcontextprotocol/sdk` needs Node ≥ 18. `.nvmrc` pinned Node 16.
- `chalk` 6 is published only as an ES module.
- `ts-node` is unmaintained, type-checks the whole program on every start (slow for an MCP server that a client launches on demand), and needed `tsconfig-paths` for the `@/` alias.
- The MCP SDK uses package `exports` maps, which `moduleResolution: node10` can't resolve. TypeScript 6 also deprecates `node10` resolution and `baseUrl`.
- TypeScript 7 (the native Go port) is out, but `typescript-eslint` supports only `<6.1`, and TypeScript 7 has no compiler API for tools to build on yet.
- `eslint-config-airbnb-base` and `eslint-config-airbnb-typescript` only support ESLint ≤ 8 (and the community `airbnb-extended` port only ESLint 9). ESLint 10 is current.

## Decision

- **Runtime:** Node 22 (`.nvmrc` `v22.18.0`, `engines.node >= 22.12.0`).
- **Modules:** the package is native ESM (`"type": "module"`). `tsconfig.json` uses `module: preserve` + `moduleResolution: bundler`, so imports stay extensionless, `exports` maps resolve, and `paths` maps `@/*` without `baseUrl`. File paths use `import.meta.dirname`.
- **Execution:** run sources directly with `tsx` (esbuild). It reads `paths` and `experimentalDecorators` from `tsconfig.json`. There is still no build step and `noEmit: true`.
- **Type-checking:** `npm run typecheck` (`tsc`), separate from execution. TypeScript is pinned to `~6.0`, the newest version the ESLint toolchain supports.
- **Linting:** ESLint 10 flat config (`eslint.config.js`) with `@eslint/js`, `typescript-eslint` (recommended), `@stylistic/eslint-plugin` and `eslint-plugin-import-x`. It reproduces the airbnb rules the code relied on: no semicolons, single quotes, 2-space indent, trailing commas, 100-character lines, blank lines between class members.
- **CLI flag:** commander 15 rejects multi-character short flags, so `-pt` became `--pt` (`--portfolio` still works).

## Consequences

- Startup is fast (about 1 s for the MCP server to complete its handshake), but `tsx` doesn't type-check. Type errors only surface through `npm run typecheck`, the editor, or CI.
- Decorators still use the legacy `experimentalDecorators` semantics that `class-validator` needs. esbuild (tsx) and Vite (Vitest) both honour the tsconfig flag.
- `chalk` and other ESM-only packages import normally.
- Users must pass `--pt EUR` instead of `-pt EUR`.
- Puppeteer 25 downloads a newer Chrome. If `npm install` skipped the download, run `npx puppeteer browsers install chrome`.
- Moving to TypeScript 7 is blocked on `typescript-eslint` support. Revisit when that lands.
