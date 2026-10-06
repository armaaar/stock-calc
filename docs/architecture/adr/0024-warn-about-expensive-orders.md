# ADR-0024: Warn about orders whose fee is a large share of their value

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

Plans reported each order's fee but never judged it. With a flat fee, small orders are expensive in relative terms. 3 EUR on a 500 EUR buy is 0.6%. Splitting the same 500 EUR across three holdings costs three fees, about 1.8%. A plan should say when an order is expensive, so the investor can decide to contribute less often in larger amounts, or skip a small top-up. That judgement only means something now that fees are accurate per security and for sells ([ADR-0020](0020-per-security-fee-overrides.md)).

## Decision

- `PortfolioSecurity.feeShare` is the order's fee divided by its absolute value. It is 0 when nothing is traded, or when the order has no value to compare with.
- The portfolio has a **fee warning percentage**: `feeWarningPercentage` in the settings file, a fraction in [0, 1] that defaults to 0.01 (1%). `Portfolio.expensiveOrders` lists the planned orders whose fee share is strictly above it.
- The view model ([ADR-0019](0019-interface-neutral-portfolio-view.md)) adds:
  - `feePercent` to each security in the modes that show trades;
  - `warnings` to those modes, one sentence per expensive order: `QDVE: the 3 EUR fee is 1.06% of the 284.5 EUR order (more than 1%)`. Money is rounded to cents. The share is rounded **up** to two decimals, so a share just above the limit never reads as equal to it. The limit is shown exactly as configured.

  The CLI prints a `Fee %` column and a `Warning: …` line per warning. The MCP tool returns both fields in its structured output.
- A warning never changes the plan. It is information, not a rule.

## Consequences

- Every plan shows how much of each order goes to fees, and points out the expensive ones in both interfaces.
- Portfolios at brokers with high flat fees can raise the threshold, and fee-free brokers can set it to 0, so any fee is flagged.
