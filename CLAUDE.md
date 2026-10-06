# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TypeScript portfolio calculator (show, rebalance, invest an amount, hit a target value, find the minimal share set), with two interfaces over the same use cases: a CLI (`src/CliApp`) and an MCP server (`src/McpApp`, registered for this repo in `.mcp.json`). It gets live prices by scraping justetf.com and tradingview.com with Puppeteer. README.md has the user-facing command reference and the portfolio file format.

## Commands

```sh
npm run cli -- <command> [options]   # tsx, e.g. `npm run cli -- rebalance --pt EGP`
npm run mcp                          # MCP server on stdio (clients should use the .mcp.json command instead)
npm run typecheck                    # tsc, type-check only. tsx does NOT type-check
npm run lint                         # ESLint 10 flat config (eslint.config.js)
npm test                             # vitest run
npm run test:coverage                # fails below 95% statements/branches/functions/lines
npx vitest run src/Entities/__tests__/Portfolio.Entity.test.ts   # one file
npx vitest run -t "rebalance"                          # tests whose name matches
```

- Node 22 (`.nvmrc`). Native ESM (`"type": "module"`), no build step (`noEmit`). TypeScript is pinned to `~6.0` because typescript-eslint doesn't support TypeScript 7 yet (ADR-0013).
- The portfolio flag is `--pt, --portfolio`. commander 15 rejects the old `-pt`.
- Portfolio files are read from `$STOCK_CALC_DATA_DIR`, or `src/data` when it's unset. The MCP server can run without a clone via `npx -y github:armaaar/stock-calc` (`bin/stock-calc-mcp.js`, ADR-0016); see `src/McpApp/CLAUDE.md` before touching `bin/` or `package.json` `files`.
- A real run launches two headless Chromium instances. To run end to end offline, copy `src/data/_settings.EUR.jsonc.example` and `_overrides.EUR.jsonc.example` to a throwaway type (for example `_settings.TMP.jsonc` / `_overrides.TMP.jsonc`; git ignores them) and use `--pt TMP`. Every price is then overridden.
- If Puppeteer can't find Chrome: `npx puppeteer browsers install chrome`.

## Architecture

Clean-architecture layers under `src/`. Imports across layers use the `#src/*` → `src/*.ts` alias, defined once in the `imports` field of `package.json` (Node subpath imports, ADR-0017). Node, tsx, tsc and Vitest all read it. Node rejects `#/`, so the prefix is `#src/`. Read `docs/architecture/overview.md` for the full picture.

```
CliApp | McpApp  (interfaces; never import each other)
  → UseCases     (one class per operation, extend PortfolioUserCase)
    → Repositories/PortfolioRepository   (anti-corruption layer: DTOs → Portfolio aggregate)
      → DataDrivers                      (zod-validated JSONC files, Puppeteer scrapers)
  Entities       (Portfolio aggregate, PortfolioSecurity, Security: rules + validation)
```

- A use case loads the `Portfolio`, changes `shares` (usually via `Portfolio.balanceForPrice`), and returns it. `initialShares` keeps the original holdings, so presenters can show trades and fees.
- Every operation exists in **both** interfaces: `CliCommands/<name>.CliCommand.ts` ↔ `McpTools/<name>.McpTool.ts`. A new use case needs both (see `src/McpApp/CLAUDE.md`).
- Folder-specific rules are in nested CLAUDE.md files: `src/Entities/`, `src/DataDrivers/`, `src/McpApp/`.

## Tests

- Vitest. Tests live in a `__tests__/` folder next to the code they cover (`src/DataDrivers/__tests__/Settings.DataDriver.test.ts` tests `src/DataDrivers/Settings.DataDriver.ts`). Never put `*.test.ts` beside the sources: Vitest only collects `src/**/__tests__/**/*.test.ts`. Shared builders are in `src/__fixtures__/` (excluded from coverage):
  - `portfolio.ts`: `buildPortfolio()`, the example portfolio QDVE 28.45 × 100 @ 40% and SPYD 62.10 × 100 @ 60%, 1 EUR flat fee.
  - `dataFiles.ts`, `puppeteer.ts` (`createFakePage`), `console.ts` (`spyOnConsole`, `printedLines`).
- There is no dependency injection, so isolate layers with `vi.mock` on module paths, using `vi.hoisted` for shared mock functions:
  - interface and use-case tests mock `#src/Repositories/Portfolio.Repository`,
  - repository tests mock the data-driver modules,
  - driver tests mock `puppeteer` / `fs`.
  Never launch a browser, hit the network, or write to `src/data` in tests.
- Tests pin current behaviour. Questionable behaviour gets a `// Current behaviour:` comment and an entry under "Known gaps" in `docs/domain/portfolio-allocation.md`.
- Worked numbers for the example portfolio, which tests assert:
  - rebalance → 127 / 87
  - invest 1000 → 141 / 97
  - target 5000 → 70 / 48
  - minimal → 3 / 2

## Documentation

`docs/` holds the architecture overview, ADRs (`docs/architecture/adr/`, template in its README), and DDD domain docs: bounded contexts, ubiquitous language, the aggregate and its invariants, use cases, and known gaps. Read the relevant doc before changing domain behaviour. Add an ADR for architecturally significant changes, and update `docs/domain/` when entity rules or use-case behaviour change.

## Conventions

- No semicolons, single quotes, 2-space indent, trailing commas, max line length 100 (ESLint enforces these).
- File naming: `<Name>.<Role>.ts`, for example `Portfolio.Entity.ts`, `GetRebalancedPortfolio.UseCase.ts`, `TradingView.DataDriver.ts`, `show.CliCommand.ts`, `show.McpTool.ts`, and `*.abstract.ts` / `*.type.ts` / `*.schema.ts`.
- New CLI commands: create `src/CliApp/CliCommands/<name>.CliCommand.ts`, add the shared `portfolioOption`, wrap the action in a try/catch that calls `ErrorCliPresenter.present`, register it in `src/CliApp/app.ts`, and add a `cli:<name>` script.
