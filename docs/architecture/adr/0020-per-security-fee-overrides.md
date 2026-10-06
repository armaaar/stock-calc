# ADR-0020: Per-security fee overrides, charged on the order's absolute value

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0011](0011-fee-model-per-security-order.md) (where fee settings come from, and how sells are charged)

## Context

ADR-0011 configured one fee tariff per portfolio and had the repository copy it onto every security. Two problems followed:

- **Brokers don't charge one tariff for every listing.** One broker charges a flat 3 EUR per order on EUR-listed ETFs but 4 USD on a USD-listed one. With a single tariff, every holding with a different one was costed wrongly.
- **Sells paid no percentage fee.** `tradedPrice` is negative for sells, so `max(percentage × tradedPrice, minimum)` always picked the minimum. Any plan that sells understated its cost once a percentage tariff was set.

`PortfolioSecurity` already took its three fee parts per security, so the domain didn't need a new concept. Only the file format and the repository forced one value.

## Decision

- The portfolio-level fees in `_settings.<TYPE>.jsonc` stay required and are the **default**.
- Each security may set any of `brokerageFeeFlat`, `tradingFeePercentage` and `minimumTradingFeeFlat`, with the same ranges as at portfolio level. **Each part falls back to the portfolio's on its own.** A security that sets only `brokerageFeeFlat` keeps the portfolio's percentage and minimum. An explicit `0` is an override, not a fallback.
- The fallback happens in `PortfolioRepository`, while it builds each `PortfolioSecurity`. The entity still only knows its own three values.
- The percentage applies to the order's **absolute** value: `tradingFee = brokerageFeeFlat + max(tradingFeePercentage × |tradedPrice|, minimumTradingFeeFlat)`. A sell is charged like a buy of the same value.
- Fees stay **per order**, not per share. They are still amounts in the portfolio's currency, with no fee currency field.

## Consequences

- Holdings on different tariffs are costed correctly, and an unchanged settings file behaves exactly as before.
- Plans that sell cost more once a percentage tariff is set. With the example portfolio (flat fee only) nothing changes.
- A fee quoted in another currency still has to be converted by hand into the portfolio's currency.
