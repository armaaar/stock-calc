# ADR-0012: Validate data files with zod

- **Status:** Accepted
- **Date:** 2026-10-06
- **Supersedes:** the typia validation part of [ADR-0007](0007-local-jsonc-portfolio-files.md). JSONC files per portfolio type remain.

## Context

Upgrading every dependency to its latest version raised these problems with typia:

- typia 15 no longer works through `ts-patch`. It requires `ttsc`, a separate compiler wrapper, to generate its validators at compile time.
- Any compile-time transform also has to run in every tool that executes TypeScript: the runtime (tsx), the test runner (Vitest), and editors. Standard fast transpilers (esbuild, oxc) skip type-aware transforms, so `typia.assert<T>()` would fail at runtime under them.
- The MCP SDK ([ADR-0014](0014-mcp-server-interface.md)) already depends on zod to describe tool inputs and outputs.

## Decision

We will describe the data-file shapes as zod schemas in `src/DataDrivers/DataFiles.schema.ts` (`SettingsSchema`, `OverridesSchema`) and derive the DTO types from them with `z.infer` in `IPriceDataDriver.type.ts`. Drivers validate with `parseDataFile(schema, data, filePath)`. It throws `Invalid data file '<path>':` followed by zod's readable issue list.

The settings driver also checks that the file exists, and throws `Portfolio '<type>' not found` instead of a raw `ENOENT`.

## Consequences

- Validation is ordinary runtime code: no compiler patching, no `postinstall`, and it works the same under tsx, Vitest and editors.
- The schema is now the single source of truth, and TypeScript types are derived from it (the reverse of the typia setup).
- Error messages name the file and the failing field path (for example `✖ Invalid input: expected number, received string → at securities[0].shares`).
- Unknown keys in data files are stripped silently, as typia's `assert` allowed them before.
