# src/ViewModels

`PortfolioView.ViewModel.ts`: `toPortfolioView(portfolio, mode)` turns a planned `Portfolio` into the interface-neutral `PortfolioView` that both presenters render (ADR-0019). It reads `Entities` and `Shared` only, never `CliApp` or `McpApp`.

- **Plain values only.** `Decimal`s become `number`s here (`.toNumber()`); percentages are in percent and rounded with `roundPercentage` (`Shared/utils.ts`). Fee warnings are full sentences built here (`feeWarnings`), so both interfaces print the same text.
- **What each `PresentMode` shows** (commands: `show` → `ONLY_INITIAL`, `minimal` → `ONLY_NEW`, `rebalance` / `target` / `invest` → `WITH_DELTA`; `ONLY_DELTA` has no command yet):

  | Mode | Securities | Per security | Totals |
  | --- | --- | --- | --- |
  | `ONLY_NEW` | all | proposed `shares`, `totalPrice`, `percent` | `portfolioPrice` |
  | `ONLY_INITIAL` | all | `initialShares` and their value and weight | `portfolioPrice` (initial), `cash` |
  | `ONLY_DELTA` | only `isBeingTraded` | traded shares and value, `percent` of the gross value traded, `tradingFee`, `feePercent` | `tradedPrice`, `tradingFee`, `cashAfterTrades`, `warnings` |
  | `WITH_DELTA` | all | proposed, plus `tradedShares`, `tradedPrice`, `tradingFee`, `feePercent` | `portfolioPrice`, `tradedPrice`, `tradingFee`, `cashAfterTrades`, `warnings` |

  Every mode also has `currency`, `securities`, and, when they apply, `portfolio` and `rates`. Change a mode here, never in a presenter, and pin it in `__tests__/PortfolioView.ViewModel.test.ts`.
- **Leave out what doesn't apply; don't set it to `undefined`.** Totals a mode doesn't have, `portfolio` without an id, `rates` when nothing is converted, and `listedPrice` / `listedCurrency` / `exchangeRate` on a security that isn't converted are absent keys (built with conditional spreads), and the tests assert `not.toHaveProperty`. The exception is `exchange`, `currency`, `priceSource` and `pricedAt`, which are copied as they are and may be `undefined`: JSON drops them over MCP, and the CLI fills in `Unknown` or leaves the cell empty.
- `rates` lists each exchange rate once, in the order the securities first use it.
- `toPortfolioView` calls `assertPresentMode` first, so an unknown mode throws.

## The MCP output schema mirrors the view

`portfolioOutputSchema` (`src/McpApp/Presenters/PortfolioMcp.Presenter.ts`) is the view as zod, with `securitySchema satisfies z.ZodType<SecurityView>` and `rateSchema satisfies z.ZodType<RateView>`. Those checks catch a wrong type but **not a missing optional field**, so when adding or renaming a field on `PortfolioView`, `SecurityView` or `RateView`, update the zod schema (with a `.describe` for clients) by hand, then the CLI presenter if the table should show it.
