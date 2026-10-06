# ADR-0010: Track initial holdings inside entities for delta reporting

- **Status:** Accepted
- **Date:** 2023-10-08
- **Introduced in:** `0b1b363` "feat: include delta in entities"

## Context

Commands like `invest`, `rebalance`, and `target` need to show both the **proposed** portfolio and the **trades** that get you there (shares to buy or sell, traded value, fees). Before this decision, use cases cloned the portfolio into "original", "new", and "delta" copies and computed differences by hand, which duplicated logic across use cases.

## Decision

`PortfolioSecurity` carries both:

- `initialShares`: the holding as loaded from settings (defaults to `shares` at construction), and
- `shares`: the proposed holding, which use cases may change.

Derived values come from the entity: `isBeingTraded`, `initialTotalPrice`, `tradedPrice`, and `tradingFee`, plus portfolio-level `initialTotalPrice`, `totalTradedPrice`, and `totalTradingFee`. Use cases change `shares` in place (usually through `Portfolio.balanceForPrice`). Presenters pick a `PresentMode` (`ONLY_NEW`, `ONLY_INITIAL`, `ONLY_DELTA`, `WITH_DELTA`) to decide which view to render.

## Consequences

- Use cases are tiny: load, change shares, return.
- Delta and fee logic live in one place, the domain.
- The aggregate is mutable after construction, and invariants aren't re-checked after mutation ([ADR-0004](0004-self-validating-entities.md)).
- A `Portfolio` represents a **plan** (before and after) rather than a snapshot. That is the main modeling idea in the [domain docs](../../domain/portfolio-allocation.md).
- `Portfolio.clone()` and `PresentMode.ONLY_DELTA` are no longer used by any command, but are kept.
