# ADR-0003: Use arbitrary-precision decimals for money and percentages

- **Status:** Accepted
- **Date:** 2023-09-10
- **Introduced in:** `caccaca` "feat: improve calculations precision"

## Context

The domain constantly multiplies and divides prices, share counts, and percentages, and compares sums against exact targets. A key example is "target percentages must add up to exactly 1". With IEEE-754 `number`, `0.1 + 0.2 !== 0.3`, so values like `0.4 + 0.6` or `0.2 + 0.4 + 0.4` can fail equality checks, and rounding errors leak into displayed prices and fees.

## Decision

We will represent prices, target percentages, fee settings, and all derived valuations as `decimal.js` `Decimal` values inside entities and use cases. Raw `number`s are converted to `Decimal` at the entity boundary (constructors). Results are converted back to `number` only for presentation (`.toNumber()`) or for validation getters (see [ADR-0004](0004-self-validating-entities.md)).

Share counts stay plain integer `number`s, rounded with `Decimal.round()` where they are derived.

## Consequences

- Comparisons such as `totalPercentage.equals(1)` are exact.
- Code is more verbose (`a.times(b).dividedBy(c)` instead of `a * b / c`), and new code must not mix `Decimal` and `number` arithmetic.
- `class-validator` can't inspect `Decimal` objects directly, so every validated `Decimal` field needs a numeric getter.
