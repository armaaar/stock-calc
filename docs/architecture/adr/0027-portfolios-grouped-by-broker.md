# ADR-0027: Portfolios live in a folder per broker

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0007](0007-local-jsonc-portfolio-files.md) (file names and selection), [ADR-0008](0008-manual-price-overrides.md) (where overrides live), [ADR-0020](0020-per-security-fee-overrides.md) (where the default fees come from)

## Context

A portfolio was a pair of files named after a "portfolio type" (`_settings.EUR.jsonc`, `_overrides.EUR.jsonc`), selected with `--pt EUR` and defaulting to `EUR`. In practice the type was a currency, but the owner thinks in brokers: an IBKR account and a Thndr account. One broker can hold several portfolios, and all of them pay the same tariff. With flat files, each portfolio repeated its broker's fees, and nothing grouped portfolios by broker.

The layout has to stay broker-agnostic (no code per broker) and easy to set up: one folder and one file should be enough to start.

## Decision

- **A broker is a folder in the data folder; a portfolio is a file in it.** `<dataDir>/<broker>/<portfolio>.jsonc` holds the portfolio, `<portfolio>.overrides.jsonc` beside it holds its optional price overrides, and `<broker>/_broker.jsonc` optionally holds what the broker's portfolios share: the fee parts and `feeWarningPercentage`.
- **A portfolio's id is `<broker>/<portfolio>`**, for example `ibkr/eur`. Each part is a name of letters, digits, `_` and `-` that starts with a letter or digit (`src/Shared/portfolioName.ts`). So an id can't leave the data folder, and `_broker` can't be selected as a portfolio. Ids are checked before any file is touched.
- **The id is optional.** With exactly one portfolio in the data folder, it's used. Otherwise the error lists every id found (`Choose a portfolio. Portfolios: ibkr/eur, thndr/egp`), and so does the error for an id that doesn't exist. If old `_settings.<name>.jsonc` files are still in the data folder, the error says how to move them. There's no `EUR` default any more.
- **Every fee part is optional and resolved part by part**: security → portfolio → broker → 0. `feeWarningPercentage` resolves portfolio → broker → 0.01. `SettingsDataDriver.getPortfolioSettings` merges the broker's file under the portfolio's, so the repository keeps its one-level security → portfolio fallback. All settings schemas stay `.strict()`.
- **The ubiquitous language changes from "portfolio type" to "portfolio id".** `IPortfolioRepository.getPortfolio(portfolioId?)`, and use-case requests take `portfolio?`.
- **Only the example broker is tracked.** `src/data/example/` replaces the `*.example` files. `.gitignore` ignores every other folder in `src/data`, and the npm package ships only the example. Because every price in it is overridden, `--pt example/eur` runs offline, which replaces copying the examples to a throwaway type.

## Consequences

- A broker's tariff is written once and shared by all its portfolios. A portfolio, or a single security, can still set its own.
- Setting up needs one file. A portfolio with no fees anywhere is costed with no fees: forgetting the fees is no longer a validation error.
- Existing data has to move: `_settings.<name>.jsonc` → `<broker>/<name>.jsonc`, `_overrides.<name>.jsonc` → `<broker>/<name>.overrides.jsonc`. The not-found error says so.
- Portfolios of one broker are planned independently. Cash the account holds for several of them is split by hand, through each portfolio's `cash`.
