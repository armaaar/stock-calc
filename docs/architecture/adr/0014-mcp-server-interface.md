# ADR-0014: Expose the use cases through an MCP server

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amended by:** [ADR-0018](0018-dependency-injection-and-composition-root.md) (tools receive their use case), [ADR-0019](0019-interface-neutral-portfolio-view.md) (shared view model)

## Context

The CLI prints tables meant for humans. AI assistants (Claude Code, Claude Desktop and other MCP clients) can't call the CLI reliably or parse its tables. The investor wants to ask an assistant things like "how should I invest 1000 EUR?" and get the same answers the CLI gives. The layered architecture ([ADR-0002](0002-layered-clean-architecture.md)) keeps all behaviour in use cases, so a second interface only needs a new outer layer.

## Decision

We will add `src/McpApp`, an MCP server that mirrors `src/CliApp` one-to-one. It uses `@modelcontextprotocol/sdk` with the stdio transport:

| CLI (`src/CliApp`) | MCP (`src/McpApp`) |
| --- | --- |
| `app.ts`: commander program | `server.ts` (`createMcpServer()`) + `app.ts` (stdio entry point) |
| `CliCommands/<name>.CliCommand.ts` | `McpTools/<name>.McpTool.ts`: tools `show`, `minimal`, `target`, `rebalance`, `invest` |
| `cliOptions.ts` (`--pt, --portfolio`) | `mcpOptions.ts` (`portfolio` input, default `EUR`; shared tool annotations) |
| `PortfolioCliPresenter` (tables) | `PortfolioMcpPresenter` (`structuredContent` matching an `outputSchema`, plus the same JSON as text) |
| `ErrorCliPresenter` (stderr) | `ErrorMcpPresenter` (`isError: true` tool result) |

- Inputs are validated with zod at the protocol boundary. This is stricter than the CLI's `Number()` conversion: `target.price` must be positive, `minimal.precision` must be in [0, 1], and `sharesStep` must be an integer ≥ 1.
- Output field names are camelCase. Percentages are in percent, as in the CLI. Traded values are signed.
- Every tool is annotated `readOnlyHint: true`, `idempotentHint: true` and `openWorldHint: true`, because the tools read public web pages but never change anything.
- `app.ts` redirects `console.log`/`info`/`debug`/`table` to stderr, because stdout carries the JSON-RPC stream.
- The repository ships a project-scoped `.mcp.json` that launches the server with `node node_modules/tsx/dist/cli.mjs src/McpApp/app.ts` (since [ADR-0016](0016-run-mcp-server-from-github.md): `node bin/stock-calc-mcp.js`). It runs `node` directly instead of going through npm or npx. `npm run` prints a banner to stdout, which would corrupt the protocol stream, and `npx` on Windows needs a `cmd /c` wrapper that would break other platforms.

## Consequences

- Assistants get typed, schema-validated results from the same use cases and domain rules as the CLI.
- Every new use case now needs a CLI command **and** an MCP tool. The mapping table above is the checklist.
- The MCP presenter mirrors the CLI presenter's modes, so the two duplicate some logic. If a third interface appears, extract an interface-neutral view model.
- Each tool call launches its own headless browsers (via the repository), the same as one CLI run.
- Claude Code asks for approval of project-scoped servers on first use.
