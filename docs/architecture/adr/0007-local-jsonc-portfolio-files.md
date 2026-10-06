# ADR-0007: Local JSONC portfolio files validated with typia

- **Status:** Accepted
- **Date:** 2023-10-07
- **Introduced in:** `c109258` "feat: support multiple portfolios" (typia, per-type files), `3355a5e` "feat: use jsonc for data"

## Context

The user keeps more than one portfolio (for example, a EUR ETF portfolio and an EGP stock portfolio), each with its own fees. Portfolio data is personal and shouldn't be committed. Users edit these files by hand and want to leave notes in them, such as why a weight was chosen or which index an ETF mirrors. Plain JSON doesn't allow comments, and earlier `.ts` data modules mixed code and data.

## Decision

- Each portfolio is a file `src/data/_settings.<TYPE>.jsonc`, selected by the `--portfolio <TYPE>` option (default `EUR`).
- Files are parsed with `jsonc-parser`, so comments are allowed, and checked at runtime with `typia.assert<SettingsDto>()`, using the same TypeScript interfaces as the code.
- Files whose names start with `_` are git-ignored. Only `*.example` templates are tracked.

## Consequences

- The TypeScript type is the single source of truth for the file schema, so there's no separate JSON Schema to keep in sync.
- `typia` generates validators at compile time through a TypeScript transformer. It needs `ts-patch` (installed by `postinstall`) and running through the patched compiler ([ADR-0009](0009-run-typescript-directly-with-ts-node.md)). Without it, `assert<T>` calls fail at runtime.
- Files are read-only inputs. The tool never updates `shares` after trades; the user does.
- Shape errors are caught by typia, and domain rules (ranges, percentages summing to 1) by the entities, so the two layers of validation give different messages.
