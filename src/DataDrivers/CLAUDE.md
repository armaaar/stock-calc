# src/DataDrivers

Infrastructure: reads the portfolio data files and scrapes prices. Returns plain DTOs. Only `src/Repositories/Portfolio.Repository.ts` turns them into entities.

## Data files

- `DataFiles.schema.ts` holds the zod schemas and is the **single source of truth** for the file shapes (ADR-0012). The DTO types in `IPriceDataDriver.type.ts` are `z.infer`'d from it. Change the schema, never the types.
- Files resolve to `src/data/_settings.<TYPE>.jsonc` and `src/data/_overrides.<TYPE>.jsonc` via `path.resolve(import.meta.dirname, '../data', …)`. JSONC is parsed with `jsonc-parser`, then `parseDataFile()` validates it and throws `Invalid data file '<path>'` with the failing field paths.
- A missing settings file throws `Portfolio '<type>' not found`. A missing overrides file means no overrides (`{}`).
- When a schema changes, update the tracked `src/data/*.jsonc.example` files. `__tests__/DataFiles.schema.test.ts` checks that they still parse. Real `_*.jsonc` files are personal and git-ignored: never read them into output, logs or commits.

## Price scrapers

- `JustEtf.DataDriver.ts` (by `isin`, 2 s timeout) and `TradingView.DataDriver.ts` (by `exchange` + `tick`, 30 s timeout) both extend `Shared/BrowserController.abstract.ts`, which holds one Chromium per driver per run.
- The repository races them with `Promise.any` (ADR-0006).
- Drivers never close their pages: the losing driver may still be using its page. The repository closes the browsers.
- When a lookup fails, the driver throws a descriptive error with the Puppeteer error as `cause`.
- Scraped text isn't validated yet: a missing element can produce `NaN` or `0` prices (see the known gaps in `docs/domain/market-data.md`).
- A new source must implement `IPriceDataDriver`, and must be added to the repository's driver list **and** its launch/close calls.
- Tests mock `puppeteer` (`src/__fixtures__/puppeteer.ts`, `createFakePage`) and `fs`. Never hit the real sites in tests.
