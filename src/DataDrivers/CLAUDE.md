# src/DataDrivers

Infrastructure: reads the portfolio data files and scrapes prices. Returns plain DTOs. Only `src/Repositories/Portfolio.Repository.ts` turns them into entities.

## Data files

- `DataFiles.schema.ts` holds the zod schemas and is the **single source of truth** for the file shapes (ADR-0012). The DTO types in `DataDrivers.type.ts` are `z.infer`'d from it. Change the schema, never the types.
- Always go through `DataFiles.reader.ts`:
  - `dataDirectory()` is `$STOCK_CALC_DATA_DIR` (with `~` expanded) or `src/data`. Users of the npx install keep their portfolios there (ADR-0016). Only `src/compositionRoot.ts` calls it; the file drivers receive the folder in their constructor (`new SettingsDataDriver(dataDir)`, ADR-0018). `vitest.config.ts` clears the variable so the `dataDirectory()` tests see the default.
  - `portfolioFiles(dataDir, portfolioId)` checks the id against `PORTFOLIO_ID_PATTERN` (`<broker>/<portfolio>`, each a name of letters, digits, `_`, `-` starting with a letter or digit) before resolving the broker's `_broker.jsonc` and the portfolio's `<portfolio>.jsonc` / `<portfolio>.overrides.jsonc`, so ids can't escape the data folder and can't select `_broker`.
  - `listPortfolioIds(dataDir)` lists every `<broker>/<portfolio>`; `readOptionalDataFile()` reads a file that may be missing, empty or only comments.
  - `parseJsonc()` rejects JSONC syntax errors with line and column.
  - After that, `parseDataFile()` validates against the schema and throws `Invalid data file '<path>'` with the failing field paths.
- The schemas check ranges as well as types (integer shares ≥ 0, fractions in [0, 1], fees ≥ 0, override prices > 0, non-empty strings). The settings schemas are `.strict()`: an unknown key, such as a misspelled per-security fee, is an error rather than a silent fallback.
- `SettingsDataDriver.resolvePortfolioId(requested?)` returns the requested id if its file exists, or the only portfolio when none is requested. Otherwise it throws, listing the portfolios found (and how to move files from before broker folders). `getPortfolioSettings(id)` returns the portfolio's settings with what it leaves out taken from `_broker.jsonc` (optional), so the repository only falls back security → portfolio. A missing, empty or comments-only overrides or broker file means nothing set.
- When a schema changes, update the tracked examples in `examples/demo/`. `__tests__/DataFiles.schema.test.ts` reads them through the drivers. Everything in `src/data` is personal and git-ignored: never read those files into output, logs or commits.

## Price scrapers

- `JustEtf.DataDriver.ts` (by `isin`, 10 s to load the page, 2 s for the quote, both set before `goto`) and `TradingView.DataDriver.ts` (by `exchange` + `tick`, 30 s timeout) both extend `Shared/BrowserController.abstract.ts`, which holds one Chromium per driver per run. Concurrent launches share one in-flight launch. The browser comes from an injected `BrowserLauncher`; only the composition root imports puppeteer's `launch`.
- Every driver has a `name` (`justetf.com`, `tradingview.com`), which the repository stamps on its quotes with the time. The repository launches browsers only when some security isn't overridden. It asks every driver at once but takes the answers in the `prices` list order, so the first driver that can price a security wins (ADR-0025). Then it awaits closing them.
- Drivers never close their pages: the losing driver may still be using its page. The repository closes the browsers.
- Scraped text must go through `parsePriceQuote()` (`PriceQuote.parser.ts`), which strips whitespace and thousands commas and requires a positive price and a non-empty currency.
- Everything from `page.goto` onwards is inside the driver's `try`. Any failure becomes the driver's descriptive "not registered" error, with the underlying error as `cause`.
- A new source must implement `IPriceDataDriver` (`DataDrivers.type.ts`) and be added to the `prices` list in `src/compositionRoot.ts`. The repository launches, asks (in list order) and closes whatever it's given.
- Scraper tests inject `fakeLauncher(...)` with fake browsers and pages (`src/__fixtures__/puppeteer.ts`). File-driver tests use real files in a temporary folder (`createDataDir`). Never hit the real sites in tests.
