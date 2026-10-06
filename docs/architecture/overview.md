# Architecture Overview

## Purpose and scope

stock-calc is a single-user, local, read-only portfolio calculator with two interfaces: a **CLI** for people and an **MCP server** for AI assistants. It loads a portfolio definition from a local file, gets the current price of each security, and calculates share counts that bring the portfolio to its target allocation. It also reports the trades and fees needed to get there.

It **does not** place orders, store history, or write back to the portfolio file. After trading, the user updates `shares` in the settings file by hand.

## System context

```mermaid
flowchart LR
  user([Investor]) -- "npm run cli -- <command>" --> cli[stock-calc CLI]
  assistant([AI assistant / MCP client]) -- "MCP over stdio (.mcp.json)" --> mcp[stock-calc MCP server]
  cli --> core[Use cases + domain]
  mcp --> core
  core -- reads --> settings[("&lt;broker&gt;/&lt;portfolio&gt;.jsonc<br/>&lt;broker&gt;/_broker.jsonc (optional)")]
  core -- reads --> overrides[("&lt;broker&gt;/&lt;portfolio&gt;.overrides.jsonc<br/>(optional)")]
  core -- "headless Chromium (Puppeteer)" --> justetf[justetf.com<br/>ETF profile by ISIN]
  core -- "headless Chromium (Puppeteer)" --> tv[tradingview.com<br/>symbol page by exchange + tick]
```

| External system | Used for | Lookup key | Notes |
| --- | --- | --- | --- |
| justetf.com | ETF quotes | `isin` | Only works for securities with an ISIN. 2 s selector timeout. |
| tradingview.com | Any listed symbol, and exchange rates | `exchange` + `tick`; `FX_IDC:<FROM><TO>` for rates | 30 s selector timeout. |
| Local JSONC files | Broker fees, portfolio definition and price overrides | Portfolio id `<broker>/<portfolio>` (`--pt`/`--portfolio` or the `portfolio` tool input; optional with one portfolio) | Git-ignored. The tracked examples are the `ibkr` and `thndr` brokers in `examples/`. |
| MCP clients (Claude Code, …) | Calling the use cases as tools | Tool name | Configured by the project's `.mcp.json`. |

## Layers

The code uses a layered "clean architecture" split ([ADR-0002](adr/0002-layered-clean-architecture.md)). Each folder under `src/` is one layer:

| Layer | Folder | Responsibility | May depend on |
| --- | --- | --- | --- |
| Interface (CLI) | `src/CliApp` | Parse arguments (commander), call a use case, render results and errors (chalk, `console.table`). | UseCases, ViewModels, Shared |
| Interface (MCP) | `src/McpApp` | Expose each use case as an MCP tool (`@modelcontextprotocol/sdk`, zod schemas). Return structured results or tool errors ([ADR-0014](adr/0014-mcp-server-interface.md)). | UseCases, ViewModels, Shared |
| View model | `src/ViewModels` | `toPortfolioView(portfolio, mode)`: what each `PresentMode` shows, as plain numbers. Both interfaces render it ([ADR-0019](adr/0019-interface-neutral-portfolio-view.md)). | Entities, Shared |
| Application | `src/UseCases` | One stateless class per user intent (`execute(request)`). Loads the portfolio through the `IPortfolioRepository` port it owns and applies a domain operation. `PortfolioUseCases` is what the interfaces receive. | Entities, Shared |
| Repository | `src/Repositories` | Implements `IPortfolioRepository`: builds the `Portfolio` aggregate from settings, overrides, and live prices, using the data drivers it's given. Acts as the anti-corruption layer between DTOs and the domain. | UseCases (its port), DataDrivers (types), Entities |
| Infrastructure | `src/DataDrivers` | Reads and validates files (zod), scrapes web pages. Returns plain DTOs. | Shared, external libraries |
| Domain | `src/Entities` | `Portfolio`, `PortfolioSecurity`, and `Security`: invariants, valuation, fees, rebalancing math. | Shared, `decimal.js`, `class-validator` |
| Shared kernel | `src/Shared` | Browser lifecycle base class, validation helper and error type, numeric and object utilities. | External libraries |
| Composition root | `src/compositionRoot.ts` | `composePortfolioUseCases(dataDir)`: the only place that picks concrete adapters, reads `$STOCK_CALC_DATA_DIR` and launches puppeteer. Called by both entry points (`CliApp/app.ts`, `McpApp/app.ts`). | Everything |

```mermaid
flowchart TD
  Root[compositionRoot] --> Repositories
  Root --> DataDrivers
  Root --> UseCases
  CliApp --> UseCases
  McpApp --> UseCases
  CliApp --> ViewModels
  McpApp --> ViewModels
  ViewModels --> Entities
  UseCases --> Entities
  Repositories -.implements IPortfolioRepository.-> UseCases
  Repositories --> DataDrivers
  Repositories --> Entities
  Entities --> Shared
  DataDrivers --> Shared
```

The two interface layers never import each other. Each has its own options file and presenters; the presenters share the `PortfolioView` view model and only render it.

Dependencies are injected through constructors and wired once, in the composition root ([ADR-0018](adr/0018-dependency-injection-and-composition-root.md)). No layer below the entry points creates its own collaborators or reads the environment.

### Where the dependency rule is relaxed

- The data-driver ports (`ISettingsDataDriver`, `IOverridesDataDriver`, `IPriceDataDriver`), the DTO types, and the zod schemas they're derived from live in `src/DataDrivers`. The repository that consumes them is itself an infrastructure adapter, so this stays on the outer side of the application.
- `minimal.CliCommand.ts` and `minimal.McpTool.ts` import default constants (`DEFAULT_ACCEPTABLE_PRECISION`, `DEFAULT_SHARES_STEP`) from their use case.

## Runtime flow

Every command and tool follows the same path. CLI `rebalance` is shown here; the MCP `rebalance` tool differs only in the first and last steps.

```mermaid
sequenceDiagram
  actor U as User
  participant C as rebalance.CliCommand<br/>(built with its use case)
  participant UC as GetRebalancedPortfolioUseCase
  participant R as PortfolioRepository
  participant S as Settings / Overrides DataDrivers
  participant P as JustEtf / TradingView DataDrivers
  participant E as Portfolio (aggregate)
  participant V as PortfolioCliPresenter

  U->>C: npm run cli -- rebalance --pt ibkr/eur
  C->>UC: execute({ portfolio })
  UC->>R: getPortfolio("ibkr/eur")
  R->>S: read + zod-validate settings & overrides
  R->>P: launchBrowser() (one Chromium per driver)
  loop each security (in parallel)
    alt tick in overrides
      R-->>R: use override price
    else
      R->>P: justEtf.getPrice + tradingView.getPrice (first in list order wins)
    end
  end
  loop each other quote currency (in parallel)
    alt pair in overrides
      R-->>R: use override rate
    else
      R->>P: tradingView.getRate(from, portfolio currency)
    end
  end
  R->>E: new Portfolio({ id, currency, securities }) (validates invariants)
  R->>P: closeBrowser() (finally)
  R-->>UC: Portfolio
  UC->>E: allocateCash(0)
  UC-->>C: Portfolio (shares mutated, initialShares kept)
  C->>V: present(portfolio, WITH_DELTA)
  V->>V: toPortfolioView(portfolio, WITH_DELTA)
  V-->>U: heading + table + totals + one Rate line per converted currency + warnings
```

Over MCP, the client calls the `rebalance` tool with `{ "portfolio": "ibkr/eur" }`. The SDK validates the input against the tool's zod schema, and `PortfolioMcpPresenter` returns the same `PortfolioView` the CLI renders as `structuredContent` (plus the same JSON as text) instead of printing a table.

### Price resolution

For each security, independently and in parallel ([ADR-0006](adr/0006-race-multiple-price-sources.md), [ADR-0008](adr/0008-manual-price-overrides.md)):

1. If the security's `tick` is a key in the overrides file, that `{ price, currency }` is used and no scraping happens.
2. Otherwise both scrapers run concurrently, and the answers are taken in list order: the first source that can price the security wins (JustEtf before TradingView, ADR-0025). The quote records that source and the time. When the security sets the `currency` it's traded in, an answer in another currency (another listing) counts as a failure, so the next source is used ([ADR-0028](adr/0028-multi-currency-portfolios.md)).
3. If both reject, the repository rejects with an `AggregateError` (`No price source could price '<tick>': check its tick, exchange and isin, or add its price to the overrides`), and the presenter shows each driver's error. Each driver error keeps the underlying Puppeteer error as its `cause`.
4. Once every price is known, each quote currency other than the portfolio's `currency` gets one exchange rate: a `<FROM>/<TO>` override, or the first rate source (TradingView's `FX_IDC` pairs) that can give it. The browsers for rates launch only if some rate isn't overridden.

Both browsers are launched together before any price is fetched, but only if at least one security isn't overridden, so a cold start costs the slowest launch rather than the sum. They are always closed, and awaited, once the load ends. If the load failed, a browser that also fails to close doesn't replace the load's error. Pages are never closed individually, because a page may still be in use by the losing driver; closing the browser cleans them up.

### Error handling

Each CLI action and each MCP tool handler is wrapped in `try/catch` and passes any error to its interface's error presenter. `ErrorCliPresenter` prints to stderr. `ErrorMcpPresenter` returns a tool result with `isError: true`. Both handle:

- `AggregateError`: each inner error is presented recursively.
- `ClassValidatorError`: a domain validation failure. Each violated property's constraints are listed, including nested children (as tables in the CLI, as indented lines over MCP).
- Any other `Error`: its name and message.

Invalid input is rejected as early as possible, in three stages:

- **CLI arguments:** commander parsers reject non-numeric numbers and invalid portfolio names with a usage error (exit code 1).
- **MCP input:** the SDK rejects input that fails a tool's zod schema before any use case runs.
- **Use cases:** they validate their parameters and throw `ClassValidatorError` for out-of-range values.

When a command fails, the CLI prints the error and exits with code 1.

## Data and configuration

- **Portfolio id** `<broker>/<portfolio>` (`--pt, --portfolio <broker/portfolio>` in the CLI, `portfolio` in MCP tools; see `src/Shared/portfolioName.ts`) selects `<broker>/<portfolio>.jsonc`, its optional `<portfolio>.overrides.jsonc`, and the broker's optional `_broker.jsonc` in the data folder: `$STOCK_CALC_DATA_DIR` if set (a leading `~` means the home folder), otherwise `src/data` in the repository ([ADR-0016](adr/0016-run-mcp-server-from-github.md), [ADR-0027](adr/0027-portfolios-grouped-by-broker.md)). Without an id, the only portfolio is used; with several, the error lists them.
- Files are JSONC (comments allowed), parsed with `jsonc-parser`, and validated at runtime with zod schemas in `src/DataDrivers/DataFiles.schema.ts` ([ADR-0007](adr/0007-local-jsonc-portfolio-files.md), [ADR-0012](adr/0012-validate-data-files-with-zod.md)). The DTO types are derived from those schemas. The fields are documented in the [README](../../README.md#portfolio).
- `.mcp.json` registers the MCP server for this project (stdio, `node bin/stock-calc-mcp.js`). Users without a clone run the same launcher with `npx -y github:armaaar/stock-calc` ([ADR-0016](adr/0016-run-mcp-server-from-github.md)).

## Technology

| Concern | Choice | Decision |
| --- | --- | --- |
| Runtime / modules | Node 22 (`.nvmrc`), native ESM (`"type": "module"`) | [ADR-0013](adr/0013-node22-esm-toolchain.md) |
| Language | TypeScript 6 (type-check only, `noEmit`; `module: preserve`, `moduleResolution: bundler`) | [ADR-0013](adr/0013-node22-esm-toolchain.md) |
| Execution | `tsx`, no build output | [ADR-0013](adr/0013-node22-esm-toolchain.md) |
| CLI | `commander` 15 + `@commander-js/extra-typings` | |
| MCP | `@modelcontextprotocol/sdk` (stdio transport) | [ADR-0014](adr/0014-mcp-server-interface.md) |
| Arithmetic | `decimal.js` | [ADR-0003](adr/0003-decimal-arithmetic.md) |
| Domain validation | `class-validator` decorators (`experimentalDecorators`) | [ADR-0004](adr/0004-self-validating-entities.md) |
| File and tool-input validation | `zod` 4 | [ADR-0012](adr/0012-validate-data-files-with-zod.md) |
| Price scraping | `puppeteer` 25 (headless Chromium) | [ADR-0005](adr/0005-scrape-prices-with-headless-browser.md) |
| CLI output | `console.table`, `chalk` | |
| Tests | Vitest 5, v8 coverage, ≥ 95% gate | [ADR-0015](adr/0015-vitest-with-coverage-gate.md) |
| Lint / style | ESLint 10 flat config: `typescript-eslint`, `@stylistic`, `import-x`. No semicolons, 100-character lines | [ADR-0013](adr/0013-node22-esm-toolchain.md) |

## Quality attributes and constraints

- **Correctness of money math:** all valuation uses `Decimal`. Share counts are integers.
- **Network and scraping fragility:** prices depend on third-party HTML (CSS selectors such as `#realtime-quotes .val` and `[data-symbol="EX:TICK"] .js-symbol-last`). Layout changes on those sites break price lookup. Overrides are the manual fallback.
- **Performance:** each run or tool call that needs a live price launches two Chromium instances (none when every price is overridden). Runtime is dominated by page loads and the TradingView timeout. The MCP server itself starts in about a second.
- **Protocol hygiene:** the MCP server must never write to stdout. `src/McpApp/app.ts` redirects console output to stderr.
- **Testability:** layers are isolated by injecting fakes (fake repository, use-case stubs, fake drivers, fake browser launcher, temporary data folders). `vi.mock` is used only at the process boundary. No test uses a real browser, the network, or `src/data`.
- **Statelessness:** nothing is persisted between runs.

## Extension points

| To add… | Do this |
| --- | --- |
| A use case | Extend `PortfolioUseCase<Request>` and implement `execute(request)`. Validate inputs first with a small value class that ends its constructor with `validateClassErrors(this, Self)`. Add it to `PortfolioUseCases` and `createPortfolioUseCases`, then expose it through **both** interfaces (next two rows). |
| A CLI command | Add `src/CliApp/CliCommands/<name>.CliCommand.ts` exporting `create<Name>Cli(useCase)` with the shared `portfolioOption` and a `try/catch` that calls `ErrorCliPresenter`, register it in `createCli` (`src/CliApp/cli.ts`), and add a `cli:<name>` npm script. |
| An MCP tool | Add `src/McpApp/McpTools/<name>.McpTool.ts` exporting `register<Name>Tool(server, useCase)` with a zod `inputSchema` (spread `portfolioInput`), `outputSchema: portfolioOutputSchema`, `portfolioToolAnnotations`, and a `try/catch` that returns `ErrorMcpPresenter.present(e)`. Register it in `src/McpApp/server.ts`. |
| A price source | Implement `IPriceDataDriver` (usually by extending `BrowserController`), then add it to the `prices` list in `src/compositionRoot.ts`. |
| A portfolio | Create `src/data/<broker>/<name>.jsonc` (and optionally `<name>.overrides.jsonc`, and `_broker.jsonc` for fees the broker's portfolios share), then run with `--pt <broker>/<name>` or call a tool with `"portfolio": "<broker>/<name>"`. |
