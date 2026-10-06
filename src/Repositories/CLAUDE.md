# src/Repositories

`Portfolio.Repository.ts` implements the use cases' `IPortfolioRepository` port and is the anti-corruption layer: the only place DTOs from `src/DataDrivers` become `PortfolioSecurity` / `Portfolio` entities (`docs/domain/market-data.md`). It receives its drivers as a `PortfolioDataDrivers` object (`settings`, `overrides`, `prices`, `rates`) and never builds or picks one; `src/compositionRoot.ts` does.

## Loading a portfolio

- **Fees fall back security → portfolio, part by part** (`brokerageFeeFlat`, `tradingFeePercentage`, `minimumTradingFeeFlat`, `fxFeePercentage`, each `security.x ?? x`). Broker defaults are already merged into the portfolio's settings by `SettingsDataDriver.getPortfolioSettings`, so don't read `_broker.jsonc` or add a third fallback level here.
- **Overrides first.** A tick or `<FROM>/<TO>` pair is overridden only when it's an *own* key of `overrides.prices` / `overrides.rates` (`isOverridden`, `Object.hasOwn`), so a tick like `toString` isn't matched by `Object.prototype`. Overridden values get `priceSource` / `source` `OVERRIDE_SOURCE` (`'override'`) and their `asOf` date as the time.
- **Live values go through `firstAnswer`**: every source is asked at once, the answers are taken in list order, so the first source in `prices` / `rates` that can answer wins however fast the others are (ADR-0025). When none can, it throws an `AggregateError` of every source's error with a message naming the tick or pair; the error presenters print each inner error. An empty source list throws a plain `Error` instead (an empty `AggregateError` would name nothing).
- **A security's traded-in `currency`** (optional in its settings) makes a quote in another currency count as that source's failure, so the next listing/source is tried (ADR-0028). An override in another currency than the security's is an error, not a skip.
- **Rates**: one per distinct quote currency other than the portfolio's `currency`, keyed `<FROM>/<portfolio currency>`. Without a portfolio `currency`, nothing is converted. `assertRatesConvertInto` rejects any rate override whose `<TO>` isn't the portfolio's currency, before anything is scraped, so a mistyped key fails fast instead of hiding behind a price error.
- Live prices and rates are time-stamped with the injected `now` clock (constructor's second argument, default `() => new Date()`). Never call `new Date()` / `Date.now()` directly; tests pass a fixed clock.

## Browser lifecycle

- Launch only when something is scraped: all `prices` sources together if some tick isn't overridden, and all `rates` sources together if some needed pair isn't overridden. Every price is overridden → no browser starts.
- Close every source exactly once at the end, even one that's in both lists (`liveSources` dedupes with a `Set`). Closing a never-launched browser is a no-op, so close unconditionally.
- On success, `await Promise.all(closeBrowsers())`. On failure, `await Promise.allSettled(closeBrowsers())` then rethrow the load's error, so a failing close never replaces why the load failed.
- Drivers never close their own pages; this class closes the browsers (see `src/DataDrivers/CLAUDE.md`).

## Tests

`__tests__/Portfolio.Repository.test.ts` uses plain fake driver objects (`fakeSettingsDataDriver`, `fakeOverridesDataDriver`, `fakePriceDataDriver(name)`, each `satisfies` its port) over the `EUR_SETTINGS` / `EUR_OVERRIDES` DTOs from `src/__fixtures__/dataFiles.ts`, and `deferred()` promises to control which source answers first. Assert that browsers are launched only when needed and closed once on every path, including failures.
