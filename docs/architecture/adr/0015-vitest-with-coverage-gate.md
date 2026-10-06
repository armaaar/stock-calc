# ADR-0015: Unit tests with Vitest and a 95% coverage gate

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

The project had no tests (`npm test` was a placeholder that exited 1). It now has two interfaces ([ADR-0014](0014-mcp-server-interface.md)) over shared use cases, and a full dependency upgrade ([ADR-0013](0013-node22-esm-toolchain.md)), so regressions are both likelier and harder to notice by hand. The code has no dependency injection ([ADR-0002](0002-layered-clean-architecture.md)): use cases create the concrete repository, and the repository creates the concrete drivers.

## Decision

- Use **Vitest** (native ESM, reads the `@/` alias from `vitest.config.ts`, honours `experimentalDecorators`) with **v8 coverage**.
- Put tests in a `__tests__/` folder next to the code they test (`src/<Layer>/__tests__/<SourceFile>.test.ts`), so source folders stay readable instead of doubling in size. Vitest only collects tests from `__tests__` folders. Shared test data lives in `src/__fixtures__/`, which is excluded from coverage, mainly `buildPortfolio()`, the tracked example portfolio.
- Isolate layers with **module mocking** (`vi.mock`) instead of introducing dependency injection:
  - use-case and interface tests mock `@/Repositories/Portfolio.Repository` or the use-case modules,
  - repository tests mock the data-driver modules,
  - scraper tests mock `puppeteer`, and file-driver tests mock `fs`.
  No test launches a browser, touches the network, or writes to `src/data`.
- The MCP server is tested end to end in-process with the SDK's `InMemoryTransport` and a real `Client`.
- `vitest.config.ts` enforces **≥ 95%** statements, branches, functions and lines over `src/**/*.ts` (excluding `__tests__`, `__fixtures__` and type-only `*.type.ts` files). `npm run test:coverage` fails below that.
- Tests document current behaviour. Questionable behaviour is pinned with a `// Current behaviour:` comment and listed under the domain docs' known gaps, rather than silently changed.

## Consequences

- Refactors and dependency upgrades are checked automatically.
- Module mocking couples tests to module paths. Moving a file means updating its `vi.mock` paths.
- The scrapers' CSS selectors are only checked against mocked pages. Changes to the real sites are still caught only by running the tool.
