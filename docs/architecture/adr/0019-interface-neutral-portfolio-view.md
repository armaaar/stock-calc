# ADR-0019: One interface-neutral portfolio view for both interfaces

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0014](0014-mcp-server-interface.md) (the follow-up it named: "extract an interface-neutral view model")
- **Amended by:** [ADR-0028](0028-multi-currency-portfolios.md) (the view names the portfolio and its rates; the CLI heads the table with them, drops the Currency column and adds a Listed column)

## Context

`PortfolioCliPresenter` and `PortfolioMcpPresenter` each held their own copy of the same presentation rules:

- what each `PresentMode` shows (proposed, current, trades only, or proposed with trades);
- which securities `ONLY_DELTA` leaves out;
- how a trade's percentage is computed (share of the gross value bought and sold);
- which totals each mode has;
- the rounding of percentages;
- the check for an unknown mode.

Only the rendering differed: a `console.table` with labelled columns, or JSON `structuredContent`. Any change to a mode had to be made twice, and nothing checked that the two agreed.

## Decision

We will compute the view once, in `src/ViewModels/PortfolioView.ViewModel.ts`, and let each presenter only render it:

- `PresentMode` lives there, and both presenters re-export it.
- `toPortfolioView(portfolio, mode)` returns a `PortfolioView`: plain numbers, percentages in percent, and the totals the mode has. It throws for an unknown mode.
- `PortfolioCliPresenter` maps a `PortfolioView` to table rows (column labels, `Unknown` for a missing exchange or currency) and total lines.
- `PortfolioMcpPresenter` returns the `PortfolioView` as `structuredContent`. Its zod output schema is checked against the view type at compile time (`satisfies z.ZodType<SecurityView>`), so the schema can't drift from the view.
- Error presenters stay separate. They share little logic, and their outputs differ in kind (coloured tables on stderr, or `isError` text).

## Consequences

- Mode rules have one home and one set of tests (`src/ViewModels/__tests__`). Presenter tests now check rendering only, and they passed unchanged, so the output didn't change.
- The view model sits between the interfaces and the domain: it reads `Portfolio`, and is read by both `CliApp` and `McpApp`. Neither interface imports the other.
- CLI totals are now formatted from numbers instead of `Decimal` strings. They read the same for money amounts with a normal number of decimal places.
- A third interface only needs a renderer for `PortfolioView`.
