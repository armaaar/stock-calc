# src/CliApp

The commander CLI. `app.ts` is the entry point (`createCli(composePortfolioUseCases()).parseAsync()`); `cli.ts` builds the program from `PortfolioUseCases`, so tests pass `stubUseCases()` instead. Mirrors `src/McpApp` one-to-one and never imports it.

## Commands and options

- Each `CliCommands/<name>.CliCommand.ts` only parses arguments, calls `useCase.execute({ portfolio, … })`, and presents the result with the same `PresentMode` its MCP tool uses. No maths, defaults or validation of its own beyond parsing.
- On error, the `catch` calls `ErrorCliPresenter.present(e)` and sets `process.exitCode = 1`. Never call `process.exit()`, and never let an error escape the action.
- Parse numbers with `cliOptions.ts` parsers (`parseFiniteNumber` rejects empty, non-numeric and infinite input with commander's `InvalidArgumentError`, which commander reports as a usage error with exit code 1). Range rules (positive, ≤ 1, integer) are the use case's value class's job, not the parser's.
- Use the shared `portfolioOption` (`--pt, --portfolio <broker/portfolio>`, parsed by `parsePortfolioId` against `PORTFOLIO_ID_PATTERN`). Don't redefine it per command, and keep its long name `--portfolio` so the action receives `portfolio`.
- Defaults come from the use case's exported `DEFAULT_*` constants, as in `minimal.CliCommand.ts`.

## Presenters

- `PortfolioCli.Presenter.ts` only renders `toPortfolioView(portfolio, mode)`. **What a mode shows changes in `src/ViewModels`, never here.** Output order:
  1. the optional `title`;
  2. a heading `<broker>/<portfolio> (<CURRENCY>)` (`headingOf`; nothing without an id, no `(…)` without a currency);
  3. one `console.table` of `COLUMNS`, in that fixed order (`sortObjectByKey` drops `undefined` cells, so columns a mode doesn't have disappear);
  4. total lines `<Label>: <value> <CURRENCY>` in the `getTotals` order;
  5. one `Rate: <FROM>/<TO> <rate> (<source> <yyyy-mm-dd hh:mm>)` line per rate;
  6. one `Warning: <sentence>` line per fee warning, then a blank line.
- There is no Currency column: the currency is in the heading and the totals. `Exchange` shows `Unknown` when missing. `Quote` is `<source> <time to the minute, UTC>` or `<source> <date>` for overrides (`sourceOf`).
- `Listed` (`<price> <CURRENCY> @ <rate>`) appears only when some security is converted, and then every row gets a cell (empty for unconverted rows), because `console.table` orders columns by the first row's keys. Keep that, or the column moves away from `Price`.
- `ErrorCliPresenter.Presenter.ts` prints to stderr in red: each inner error of an `AggregateError` recursively, a `ClassValidatorError` with one `console.table` of constraints per violated property (nested children indented with more `-`), any other `Error` as `<name>: <message>`, and anything else as `String(error)`. It doesn't set the exit code; the command does.
- Presenters are the only place that prints. They `/* eslint-disable no-console */` at the top; nothing else in the layer uses `console`.

## Tests

Command and program tests (`CliCommands/__tests__`, `__tests__/cli.test.ts`) use `stubUseCases()` and assert the request passed and the `PresentMode`. Presenter tests render real views with `spyOnConsole()` / `printedLines()` (`src/__fixtures__/console.ts`). `__tests__/app.test.ts` runs the real entry point against `createDataDir(exampleFiles())` with `STOCK_CALC_DATA_DIR` stubbed.
