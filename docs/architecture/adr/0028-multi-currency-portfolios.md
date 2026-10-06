# ADR-0028: Securities listed in another currency are converted at an exchange rate, with an FX fee

- **Status:** Accepted
- **Date:** 2026-10-06
- **Supersedes:** [ADR-0026](0026-single-currency-portfolios.md)
- **Amends:** [ADR-0011](0011-fee-model-per-security-order.md) and [ADR-0020](0020-per-security-fee-overrides.md) (an FX fee part), [ADR-0025](0025-price-quotes-with-source-and-priority.md) (sources may be skipped for quoting another listing)

## Context

ADR-0026 kept every portfolio in one currency and said to revisit it "only if portfolios genuinely need several currencies". They do. The owner's IBKR EUR portfolio holds ICOM, which trades in USD on the LSE. Buying it with EUR goes through IBKR's automatic currency conversion, which charges 0.03% of the order's value. With one currency, ICOM had to be priced from a EUR listing, and the conversion fee was invisible.

A live check also showed a second problem: justetf.com quotes ICOM from a EUR listing. Asking "what does it cost" is not enough when the source may answer for another listing than the one you trade.

## Decision

- **A portfolio has a currency: the one orders are paid in** (`currency` in the portfolio file, a 3-letter code). Every price, fee, cash amount and total is in it. Without it, it's the first security's quote currency, as before.
- **A security quoted in another currency is converted.** The repository gets one exchange rate per other quote currency, into the portfolio's. `PortfolioSecurity.price` and `.currency` are then in the portfolio's currency, so the allocation maths is unchanged. `quote` keeps the listed price and currency, and `exchangeRate` (an `ExchangeRate` value object: `from`, `to`, `rate`, `source`, `quotedAt`) records the conversion. A rate whose `from` isn't the quote's currency is rejected.
- **P3 becomes: every (converted) price is in the portfolio's currency.** A portfolio without a `currency` whose securities are quoted in several currencies still fails, and the error says to set the currency.
- **Rates come from live sources, or overrides.** `IExchangeRateDataDriver.getRate(from, to)` is a second port. TradingView implements it by reading the `FX_IDC:<FROM><TO>` symbol page, which is quoted in `<TO>`. A rate in another currency is rejected. Rate sources are asked like price sources ([ADR-0025](0025-price-quotes-with-source-and-priority.md)): all at once, answers taken in list order, `AggregateError` when none can. They're launched only when some rate isn't overridden. A source that gives prices and rates, such as TradingView, is one browser, launched for both and closed once. In the overrides file, a key `<FROM>/<TO>` holds a rate (`{ "rate": 0.92, "asOf": "2026-10-01" }`), stamped `override`. A rate override that doesn't convert into the portfolio's currency could never be used, so it's an error, and override prices need 3-letter currency codes.
- **An FX fee, `fxFeePercentage`, is a fourth fee part**, resolved like the others (security → portfolio → broker → 0, [ADR-0027](0027-portfolios-grouped-by-broker.md)). A converted order pays `fxFeePercentage × |tradedPrice|` on top of its trading fee, for buys and sells alike. It's part of `tradingFee`, so fee warnings, budgets and `cashAfterTrades` include it.
- **A security can name the currency it's traded in** (`currency` on the security). A source that quotes it in another currency is skipped, so the next source prices the right listing. An override in another currency is an error.
- **Interfaces show both prices.** The view gives each converted security `listedPrice`, `listedCurrency` and `exchangeRate`, and the portfolio's `rates` (with source and time) and `portfolio` id. The CLI heads the table with `ibkr/eur (EUR)`, drops the Currency column (every row is in the portfolio's currency), adds a `Listed` column (`41.2 USD @ 0.9`) when something is converted, and prints a `Rate:` line per pair.

## Consequences

- A holding traded in another currency is valued at today's rate and costed with the conversion fee. The worked examples, which are all in one currency, don't change.
- A plan that needs a live rate opens TradingView even when every price is overridden.
- Fees stay amounts in the portfolio's currency. A commission the broker charges in the listing's currency (4 USD on a USD listing) is still entered converted, and drifts by cents with the rate.
- The FX fee has no minimum, which matches IBKR's automatic conversion but not its manual conversions (minimum 2 USD).
- A quote in a minor unit, such as GBX (pence), has no FX_IDC pair. Such a security needs a price override in a major currency.
