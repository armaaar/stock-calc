# src/DataDrivers

Infrastructure: reads the portfolio data files and scrapes prices. Returns plain DTOs. Only `src/Repositories/Portfolio.Repository.ts` turns them into entities.

## Data files

- `DataFiles.schema.ts` holds the zod schemas and is the **single source of truth** for the file shapes (ADR-0012). The DTO types in `DataDrivers.type.ts` are `z.infer`'d from it. Change the schema, never the types.
- Always go through `DataFiles.reader.ts`:
  - `dataDirectory()` is `$STOCK_CALC_DATA_DIR` (with `~` expanded) or `src/data`. Users of the npx install keep their portfolios there (ADR-0016). Only `src/compositionRoot.ts` calls it; the file drivers receive the folder in their constructor (`new SettingsDataDriver(dataDir)`, ADR-0018). `vitest.config.ts` clears the variable so the `dataDirectory()` tests see the default.
  - `dataFilePath(dataDir, prefix, type)` checks the portfolio name against `PORTFOLIO_NAME_PATTERN` (letters, digits, `_`, `-`) before resolving `<data folder>/_<prefix>.<TYPE>.jsonc`, so names can't escape the data folder.
  - `parseJsonc()` rejects JSONC syntax errors with line and column.
  - After that, `parseDataFile()` validates against the schema and throws `Invalid data file '<path>'` with the failing field paths.
- The schemas check ranges as well as types (integer shares ≥ 0, fractions in [0, 1], fees ≥ 0, override prices > 0, non-empty strings).
- A missing settings file throws `Portfolio '<type>' not found`. A missing, empty or comments-only overrides file means no overrides (`{}`).
- When a schema changes, update the tracked `src/data/*.jsonc.example` files. `__tests__/DataFiles.schema.test.ts` checks that they still parse. Real `_*.jsonc` files are personal and git-ignored: never read them into output, logs or commits.

## Price scrapers

- `JustEtf.DataDriver.ts` (by `isin`, 2 s timeout) and `TradingView.DataDriver.ts` (by `exchange` + `tick`, 30 s timeout) both extend `Shared/BrowserController.abstract.ts`, which holds one Chromium per driver per run. Concurrent launches share one in-flight launch. The browser comes from an injected `BrowserLauncher`; only the composition root imports puppeteer's `launch`.
- The repository launches browsers only when some security isn't overridden, races the drivers with `Promise.any` (ADR-0006), and awaits closing them.
- Drivers never close their pages: the losing driver may still be using its page. The repository closes the browsers.
- Scraped text must go through `parsePriceQuote()` (`PriceQuote.parser.ts`), which strips whitespace and thousands commas and requires a positive price and a non-empty currency.
- Everything from `page.goto` onwards is inside the driver's `try`. Any failure becomes the driver's descriptive "not registered" error, with the underlying error as `cause`.
- A new source must implement `IPriceDataDriver` (`DataDrivers.type.ts`) and be added to the `prices` list in `src/compositionRoot.ts`. The repository launches, races and closes whatever it's given.
- Scraper tests inject `fakeLauncher(...)` with fake browsers and pages (`src/__fixtures__/puppeteer.ts`). File-driver tests use real files in a temporary folder (`createDataDir`). Never hit the real sites in tests.
