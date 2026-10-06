# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TypeScript CLI that calculates share counts for a stock/ETF portfolio (show, rebalance, invest an amount, hit a target value, find the minimal share set). It reads live prices by scraping justetf.com and tradingview.com with Puppeteer. See README.md for the user-facing command reference and the portfolio settings format.

## Commands

```sh
npm install                          # also runs `ts-patch install` (postinstall); required for typia
npm run cli -- <command> [options]   # run via ts-node, e.g. `npm run cli -- rebalance -pt EGP`
npx tsc                              # type-check only (tsconfig has noEmit; there is no build step)
npm run lint                         # eslint (airbnb-base + airbnb-typescript)
npm run lint:fix
```

- There are no tests. `npm test` is a placeholder that exits 1.
- `.nvmrc` pins Node v16.16.0. The code relies on `Promise.any`/`AggregateError`, so Node 15+ is required.
- Running any command launches two headless Chromium instances. It only skips network access when every security has a price override. To run end to end offline, copy `src/data/_settings.EUR.jsonc.example` and `_overrides.EUR.jsonc.example` to a throwaway type (for example `_settings.TMP.jsonc` / `_overrides.TMP.jsonc`), then run `npm run cli -- rebalance -pt TMP`.

## Documentation

`docs/` holds the architecture overview, ADRs (`docs/architecture/adr/`), and DDD domain docs: bounded contexts, ubiquitous language, the aggregate and its invariants, and use cases with known gaps. Read the relevant doc before changing domain behavior. When you make an architecturally significant change, add an ADR (template in `docs/architecture/adr/README.md`). Update `docs/domain/` whenever entity rules or use-case behavior change.

## Architecture

Clean-architecture layering under `src/`. Imports across layers use the `@/*` → `src/*` path alias, which ts-node resolves via `tsconfig-paths/register`.

```
CliApp (commander commands + presenters)
  → UseCases (one class per command, all extend PortfolioUserCase)
    → Repositories/PortfolioRepository (assembles a Portfolio entity)
      → DataDrivers (settings file, overrides file, price scrapers)
  Entities (Portfolio, PortfolioSecurity, Security) — domain logic + validation
```

**Data flow:** each CLI command builds a UseCase with the `--portfolio` type (default `EUR`). The use case's `handler()` calls `getSourcePortfolio()`, which goes to `PortfolioRepository.getPortfolio(type)`. The use case mutates `security.shares` on the returned portfolio (usually via `Portfolio.balanceForPrice`), and the CLI passes the result to `PortfolioCliPresenter` with a `PresentMode`. `initialShares` keeps the original count so presenters can show traded deltas and fees.

**Portfolio data files** live in `src/data/` and are git-ignored. Everything starting with `_` is ignored; only `*.example` files are tracked.
- `_settings.<TYPE>.jsonc` (required): fees plus a list of securities. It's parsed with `jsonc-parser` and validated at runtime with `typia.assert<SettingsDto>`. typia works through a compile-time transform (tsconfig `plugins` + ts-patch), so `assert<T>` calls only work when compiled through the patched TypeScript.
- `_overrides.<TYPE>.jsonc` (optional): manual prices that skip scraping. It's a `Record<tick, { price, currency }>`, keyed by tick.

**Price resolution** (`PortfolioRepository.getPrice`): if the tick is in overrides, that price is used. Otherwise the JustEtf driver (needs `isin`, 2s timeout) and the TradingView driver (`exchange-tick`, 30s timeout) race with `Promise.any`, and the first success wins. If both fail, the resulting `AggregateError` is unpacked by `ErrorCliPresenter`. Each driver extends `BrowserController`, which owns one Puppeteer browser. The repository launches both browsers up front and closes them in `finally`. New price sources should implement `IPriceDataDriver` and be added to the drivers list in the repository.

**Entities and validation:**
- Monetary and percentage values are `decimal.js` `Decimal`s. Keep arithmetic in Decimal.
- Validation uses `class-validator` decorators. Constraints on Decimal fields go on `protected get xxxValue(): number` getters, because the validators can't inspect Decimal objects.
- Each constructor ends with `validateClassErrors(this, ClassName)`. That function only validates when `this.constructor.name === ClassName`, so a subclass instance is validated once, by the most-derived constructor, after all fields are set. Follow this pattern in new entities and use cases (see `GetPortfolioWithMinimumSharesUseCase`).
- The `Portfolio` constructor throws if target percentages don't sum to exactly 1, or if securities have mixed currencies.
- `clone()` methods rebuild entities through their constructors, so validation runs again.

## Conventions

- No semicolons (ESLint enforces this). Max line length is 100.
- File naming: `<Name>.<Role>.ts`, for example `Portfolio.Entity.ts`, `GetRebalancedPortfolio.UseCase.ts`, `TradingView.DataDriver.ts`, `show.CliCommand.ts`, and `*.abstract.ts` / `*.type.ts`.
- New CLI commands: create `src/CliApp/CliCommands/<name>.CliCommand.ts`, add the shared `portfolioOption`, wrap the action in try/catch that calls `ErrorCliPresenter.present`, and register it in `src/CliApp/app.ts`.
