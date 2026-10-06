# src/McpApp

MCP server exposing the use cases as tools. It mirrors `src/CliApp` one-to-one (ADR-0014). Launched by the repo's `.mcp.json`.

## Never write to stdout

stdout carries the JSON-RPC stream. One stray `console.log` (or an npm banner) corrupts the session.
- `app.ts` redirects `console.log` / `info` / `debug` / `table` to stderr. Keep that redirect at the top of the entry point.
- Log diagnostics with `console.error`.
- `.mcp.json` runs `node bin/stock-calc-mcp.js`, the same launcher users get with `npx -y github:armaaar/stock-calc` (ADR-0016). Don't change it to `npm run mcp`, because npm prints its banner to stdout. Don't change it to `npx`, because Windows needs `cmd /c npx`, which breaks other platforms.

## Running from GitHub

- `bin/stock-calc-mcp.js` registers tsx with the package's own `tsconfig.json`, then `bin/alias-hooks.js`, then imports `app.ts`. The hook maps `@/x` to `src/x.ts`, because tsx ignores tsconfig `paths` inside `node_modules`, which is where npx installs the package. Keep every `@/` import pointing at a `.ts` file.
- Runtime code may only import `dependencies`, never devDependencies; `tsx` is a dependency for this reason.
- `files` in `package.json` decides what an install contains. After adding a runtime folder, check `npm pack --dry-run`. Personal `src/data/_*.jsonc` files must never appear in it.
- Before changing the launcher, test the installed path rather than the repo path: `npm pack`, then from another folder `npm exec --yes --package <tgz> -- stock-calc-mcp` with `STOCK_CALC_DATA_DIR` set, connected through the SDK's `StdioClientTransport`.

## Structure

| File | Role | CLI counterpart |
| --- | --- | --- |
| `server.ts` | `createMcpServer()`: builds the server and registers every tool. Kept separate from `app.ts` so tests can connect in memory. | `CliApp/app.ts` |
| `app.ts` | stdio entry point: console redirect, then `connect(new StdioServerTransport())` | |
| `McpTools/<name>.McpTool.ts` | `register<Name>Tool(server)` | `CliCommands/<name>.CliCommand.ts` |
| `mcpOptions.ts` | `portfolioInput` (zod, default `EUR`) and `portfolioToolAnnotations` | `cliOptions.ts` |
| `Presenters/PortfolioMcp.Presenter.ts` | `portfolioOutputSchema`, plus `structuredContent` and the same JSON as text, per `PresentMode` | `PortfolioCli.Presenter.ts` |
| `Presenters/ErrorMcp.Presenter.ts` | tool result with `isError: true` (AggregateError and ClassValidatorError aware) | `ErrorCliPresenter.Presenter.ts` |

## Adding a tool

Copy an existing `McpTools/*.McpTool.ts`:
- Use the CLI command's name as the tool name, and reuse its description.
- `inputSchema`: zod fields for the command's arguments, plus `...portfolioInput`. Mirror the use case's input rules in zod (positive prices, ranges, integers, `PORTFOLIO_NAME_PATTERN`), so clients get schema errors before anything runs. The CLI does the same with commander argument parsers in `cliOptions.ts`. Use the use case's `DEFAULT_*` constants as zod defaults.
- `outputSchema: portfolioOutputSchema`, `annotations: portfolioToolAnnotations`.
- Wrap the handler in `try/catch` and return `ErrorMcpPresenter.present(e)`. Never throw out of a handler.
- Pass the same `PresentMode` the CLI command uses.
- Register the tool in `server.ts`, add a case to `__tests__/server.test.ts`, and add the tool to the README and `docs/domain/use-cases.md`.

## Testing

`__tests__/server.test.ts` connects a real SDK `Client` through `InMemoryTransport.createLinkedPair()`. It mocks only `@/Repositories/Portfolio.Repository` (returning `buildPortfolio()`), so the real use cases and domain run. `__tests__/app.test.ts` mocks the stdio transport.

For a manual end-to-end check, spawn the exact `.mcp.json` command with the SDK's `StdioClientTransport` against a throwaway `--pt` data type (see the root CLAUDE.md).
