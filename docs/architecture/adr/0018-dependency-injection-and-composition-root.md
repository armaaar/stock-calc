# ADR-0018: Constructor injection and a composition root

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0002](0002-layered-clean-architecture.md) (dependency direction), [ADR-0015](0015-vitest-with-coverage-gate.md) (how tests isolate layers)

## Context

Every layer created its own dependencies:

- each use case did `new PortfolioRepository()`;
- the repository did `new SettingsDataDriver()`, `new JustEtfDataDriver()`, …;
- the file drivers read `$STOCK_CALC_DATA_DIR` themselves;
- the scrapers imported puppeteer's `launch`.

So the application layer depended on the concrete repository, and through it on files and Puppeteer. The only way to isolate a layer in a test was to replace whole modules with `vi.mock`, using `vi.hoisted` for shared fakes. Those tests were tied to file paths and module structure, not to contracts. They broke on any move or rename and checked how a module was wired, not what it promised.

## Decision

We will use plain constructor injection, wired in one composition root. There is no DI container: the object graph is small and fixed.

- **Driven ports belong to the side that needs them.** `IPortfolioRepository` lives in `src/UseCases` (the application says what it needs). `PortfolioRepository` implements it. `ISettingsDataDriver`, `IOverridesDataDriver` and `IPriceDataDriver` live in `src/DataDrivers/DataDrivers.type.ts`, and the repository receives them as `{ settings, overrides, prices: IPriceDataDriver[] }`.
- **Use cases are stateless services.** They are built once with their repository, and each call passes a request: `execute({ portfolioType, … })`. They replace `new X(portfolioType, …).handler()`. Inputs are validated by small value classes (`Investment`, `TargetPrice`, `MinimumSharesSearch`) at the start of `execute`, before anything is loaded.
- **Driver ports are what interfaces receive.** `PortfolioUseCases` (`src/UseCases/PortfolioUseCases.factory.ts`) maps each command/tool name to an `IPortfolioUseCase<Request>`. `createPortfolioUseCases(repo)` builds them. CLI commands are factories (`createInvestCli(useCases.invest)`, `createCli(useCases)`). MCP tools are registered with their use case (`registerInvestTool(server, useCases.invest)`, `createMcpServer(useCases)`).
- **Configuration is injected, not read deep inside.** File drivers take the data folder (`new SettingsDataDriver(dataDir)`), and `dataFilePath(dataDir, prefix, type)` takes it too. Scrapers take a `BrowserLauncher` (`() => Promise<Browser>`).
- **One composition root.** `src/compositionRoot.ts` exports `composePortfolioUseCases(dataDir = dataDirectory())`. It is the only module that reads `$STOCK_CALC_DATA_DIR`, imports puppeteer's `launch` (`{ headless: true }`), and picks the concrete drivers. The two entry points (`CliApp/app.ts`, `McpApp/app.ts`) call it and do nothing else.

## Consequences

- Dependencies now point inward. The application layer imports only its own port and the domain. The repository is an adapter that implements a use-case port.
- Tests pass fakes instead of mocking modules:
  - use-case and MCP-server tests use `fakePortfolioRepository()`, so the real use cases and domain run;
  - CLI command tests use `stubUseCases()`;
  - repository tests pass fake drivers;
  - scraper tests pass `fakeLauncher(...)`;
  - file-driver tests read real files from a temporary folder (`createDataDir`).
  - `vi.mock` is left only at the process boundary: the stdio transport in the MCP entry-point test, and puppeteer in the composition-root test.
- The composition root and the entry points can be tested end to end with the tracked examples, where every price is overridden, so no browser starts.
- A new use case needs one more line: an entry in `PortfolioUseCases` and `createPortfolioUseCases`.
- Validation errors name the value classes (`Class 'Investment' validation failed`, property `amount`) instead of the use-case class.
- Interfaces construct nothing from the application layer, so a third interface only needs a `PortfolioUseCases`.
