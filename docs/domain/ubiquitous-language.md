# Ubiquitous Language

Terms used consistently across the code, settings files, CLI output, and these docs. **Code** shows where the term appears. **CLI column** shows the matching column header in table output.

## Portfolio and holdings

| Term | Definition | Code | CLI column |
| --- | --- | --- | --- |
| **Portfolio** | A set of securities held together, priced in one currency, with target weights that sum to 100%. The aggregate root. | `Portfolio` | |
| **Portfolio type** | The name that selects a portfolio's settings and overrides files (for example `EUR`, `EGP`). It's just a name; it often matches the currency by convention. | `portfolioType`, `--portfolio` / `-pt` | |
| **Security** | A tradable instrument identified by tick and exchange (and optionally ISIN), with a current price and currency. | `Security` | |
| **Portfolio security** (holding, position) | A security as held in a portfolio: share counts, target percentage, and fee settings. | `PortfolioSecurity` | one table row |
| **Tick** (ticker) | The exchange symbol of a security, such as `QDVE` or `ETEL`. The practical identity of a security within a portfolio, and the key for price overrides. | `tick` | Tick |
| **Exchange** | The venue code used with the tick to identify a listing, such as `IBIS2` or `EGX`. TradingView uses it as `EXCHANGE-TICK`. | `exchange` | Exchange |
| **ISIN** | 12-character International Securities Identification Number. Optional. Lets justetf.com find ETFs. | `isin` | |
| **Shares** | Number of whole units held in the **proposed** state of the portfolio. | `shares` | Shares |
| **Initial shares** | Number of units held **now**, as loaded from settings. Never changed by use cases. | `initialShares` | Shares (in `show`) |
| **Target percentage** (target weight) | The fraction of portfolio value a security should make up, as a decimal in [0, 1]. All targets sum to exactly 1. Shown ×100. | `targetPercentage` | Target Percentage % |
| **Actual percentage** (actual weight) | A security's value divided by the portfolio's value, in a given state. | `calcActualPercentage()` | Percentage % |
| **Currency** | The currency of a quote. All securities in a portfolio must share one currency. | `currency` | Currency |

## Valuation

| Term | Definition | Code | CLI column |
| --- | --- | --- | --- |
| **Price** | Current price of one share, from market data or an override. | `price` | Price |
| **Total price** (market value) | `price × shares` for a security, or the sum over securities for the portfolio (proposed state). | `totalPrice` | Total Price, "Portfolio Price" |
| **Initial total price** | `price × initialShares`: the value of current holdings. | `initialTotalPrice` | "Portfolio Price" (in `show`) |
| **Traded price** (trade value) | `totalPrice − initialTotalPrice`. Positive means buy, negative means sell. | `tradedPrice`, `totalTradedPrice` | Trading Price, "Trading Price" |
| **Traded shares** | `shares − initialShares`. Positive means buy, negative means sell. | (presenter) | Traded Shares |
| **Being traded** | True when a security's proposed shares differ from its initial shares, meaning an order is needed. | `isBeingTraded` | |

## Fees

| Term | Definition | Code |
| --- | --- | --- |
| **Brokerage fee (flat)** | Fixed amount charged per order, whatever its size. | `brokerageFeeFlat` |
| **Trading fee percentage** | Fraction of order value charged per order, in [0, 1]. | `tradingFeePercentage` |
| **Minimum trading fee (flat)** | Floor for the percentage-based part of the fee. | `minimumTradingFeeFlat` |
| **Trading fee** | Total cost of one security's order: `brokerageFeeFlat + max(tradingFeePercentage × tradedPrice, minimumTradingFeeFlat)`, or 0 if not traded. Shown in the "Trading Fee" column and summed in the "Trading Fee" summary line. | `tradingFee`, `totalTradingFee` |
| **Order** | Buying or selling one security. Each traded security counts as exactly one order. | (implicit) |

## Operations

| Term | Definition | Command |
| --- | --- | --- |
| **Balance (for a price)** | Set each security's shares to `round(price × targetPercentage ÷ securityPrice)`, so the portfolio is worth about `price` at target weights. | `Portfolio.balanceForPrice` |
| **Rebalance** | Balance for the portfolio's current value: restore target weights without adding money. | `rebalance` |
| **Invest** | Balance for current value plus an additional investment. | `invest <investment>` |
| **Target (price)** | Balance for an absolute portfolio value. | `target <price>` |
| **Minimal portfolio** | The smallest whole-share allocation whose actual weights are all within *precision* of targets. | `minimal` |
| **Precision** (acceptable deviation) | Maximum allowed absolute difference between actual and target percentage, as a fraction (0.01 = 1 percentage point). | `--precision`, `acceptablePrecision` |
| **Shares step** | The unit by which share counts are increased in the minimal search. Results are multiples of it. | `--shares-step`, `sharesStep` |

## Market data

| Term | Definition | Code |
| --- | --- | --- |
| **Price quote** | A `{ price, currency }` pair for one security. | `SecurityPriceDto` |
| **Price source** (data driver) | A provider that can produce a price quote for a security. | `IPriceDataDriver` |
| **Price override** | A manually set quote for a tick that replaces live price lookup. | `_overrides.<TYPE>.jsonc`, `OverridesDataDriver` |
| **Portfolio settings** | The file that defines a portfolio: fees, plus securities with shares and targets. | `_settings.<TYPE>.jsonc`, `SettingsDto` |
