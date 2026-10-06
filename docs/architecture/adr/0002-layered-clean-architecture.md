# ADR-0002: Layered clean architecture

- **Status:** Accepted
- **Date:** 2023-09-09
- **Introduced in:** `4d56948` "refactor: refactor code to be domain driven"

## Context

The first versions (2022) were a single `index.ts`, followed by a few flat modules (`scrab_price.ts`, `securities.ts`). Price scraping, portfolio math, and console output were mixed together. More commands were planned (target price, rebalance, invest), and they all needed the same "load portfolio, compute, print" pipeline with different calculations in the middle.

## Decision

We will organize `src/` into explicit layers, one folder each, named after their role:

- `CliApp`: commands (`*.CliCommand.ts`) and presenters (`*.Presenter.ts`).
- `UseCases`: one application service per user intent (`*.UseCase.ts`), all extending `PortfolioUserCase`.
- `Repositories`: assemble domain aggregates from data sources (`*.Repository.ts`).
- `DataDrivers`: I/O against files and websites, returning DTOs (`*.DataDriver.ts`).
- `Entities`: the domain model (`*.Entity.ts`).
- `Shared`: cross-cutting helpers.

Dependencies point inward, from the CLI toward Entities. Imports across layers use the `@/` path alias.

## Consequences

- Each new command is a thin CLI file plus a small use case. Portfolio loading and presentation are reused.
- The domain math in `Entities` doesn't depend on Puppeteer, the file system, or the CLI.
- The file suffix makes each file's layer obvious from its name.
- There is no dependency injection: use cases create the concrete repository, and the repository creates concrete drivers. This keeps the code short but makes isolated testing hard. Adding constructor injection is a likely follow-up if tests are introduced.
- Port interfaces and DTOs live with the drivers (`DataDrivers/IPriceDataDriver.type.ts`), so the inward dependency rule holds only by convention.
