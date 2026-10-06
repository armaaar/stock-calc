# ADR-0011: Model trading fees per security order

- **Status:** Accepted
- **Date:** 2023-10-08
- **Amended by:** [ADR-0020](0020-per-security-fee-overrides.md) (per-security fee overrides; the percentage applies to sells too), [ADR-0022](0022-plans-stay-within-available-cash.md) (`invest` and `rebalance` budget the fees)
- **Introduced in:** `7b4f3a4` "feat: add trading fees"

## Context

Brokers charge per order, and different brokers (one per portfolio) use different structures: a flat brokerage fee, a percentage of order value, and a minimum fee. Knowing the cost of a rebalance helps decide whether it's worth doing.

## Decision

- Fee settings (`brokerageFeeFlat`, `tradingFeePercentage`, `minimumTradingFeeFlat`) are configured **per portfolio** in the settings file.
- The repository copies them onto **each** `PortfolioSecurity`, so each security can compute the fee of its own order:

  ```
  tradingFee = 0                                            if shares == initialShares
             = brokerageFeeFlat
               + max(tradingFeePercentage × tradedPrice, minimumTradingFeeFlat)   otherwise
  ```

- The portfolio's total fee is the sum over its securities. One traded security equals one order.
- Fees are **reported**, not **budgeted**: allocation algorithms don't subtract fees from the amount being allocated.

## Consequences

- Fee calculation is local to a security and easy to reason about.
- Fee settings are duplicated on every security instead of living on the `Portfolio` aggregate, and nothing guarantees they are consistent across securities.
- `tradedPrice` is signed, so for **sells** the percentage part is negative and the `max` falls back to `minimumTradingFeeFlat`. In effect, sells are charged only `brokerageFeeFlat + minimumTradingFeeFlat`, regardless of order size. If sells should be charged a percentage too, the formula should use the absolute traded value. See [known gaps](../../domain/portfolio-allocation.md#known-gaps-and-open-questions).
- `invest X` and `target X` can spend slightly more than `X` once fees (and share rounding) are included.

> **Update:** [ADR-0020](0020-per-security-fee-overrides.md) lets each security override the fee parts and applies the percentage to the absolute order value, so sells now pay it too. The consequences above describe the model as it was decided here. [ADR-0022](0022-plans-stay-within-available-cash.md) budgets fees: `invest` and `rebalance` never need more cash than they're given, fees included.
