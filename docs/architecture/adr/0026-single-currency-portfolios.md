# ADR-0026: Portfolios are single-currency, with fees in that currency and no FX conversion

- **Status:** Superseded by [ADR-0028](0028-multi-currency-portfolios.md)
- **Date:** 2026-10-06

## Context

Invariant P3 requires every security in a portfolio to be quoted in the same currency, and every fee value is an amount in that currency. Brokers sometimes list a security in another currency, such as a USD-listed ETF in a EUR account, or charge a fee in another currency, such as 4 USD per order on that listing. These two limits were recorded as open questions in the domain docs.

Supporting them would mean exchange rates: a rate source, its freshness, and which rate the broker applies. It would also mean a currency on every fee and every quote, and conversions throughout the allocation maths. The portfolio owner has decided against this. Portfolios stay single-currency, there's no fee currency field, and there's no conversion.

## Decision

- **A portfolio has exactly one currency (P3).** A security listed in another currency is used through a price in the portfolio's currency, either from a source that quotes it that way or through a price override. A mixed portfolio fails and names every security's currency: `Portfolio has securities in different currencies (QDVE: EUR, ICOM: USD). Price them all in one currency, for example with a price override`.
- **Fees are amounts in the portfolio's currency.** A fee quoted in another currency is entered converted by hand, for example 4 USD ≈ 3.56 EUR, as a per-security override ([ADR-0020](0020-per-security-fee-overrides.md)). The README says so.
- There's no exchange-rate source, no currency field on fees, and no conversion anywhere in the model.

## Consequences

- The allocation maths stays in one currency, with no rates to fetch, store or age.
- A hand-converted fee drifts with the exchange rate, by cents per order. This is accepted, because fees are small and the fee warning ([ADR-0024](0024-warn-about-expensive-orders.md)) works on shares, not exact amounts.
- Holding a foreign-listed security means maintaining its price override in the portfolio's currency, or using a source that quotes it in that currency.
- Revisit this decision only if portfolios genuinely need several currencies. That would be a new bounded context (FX), not a change to this one.
