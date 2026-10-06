# src/Entities

The domain model: the `Portfolio` aggregate root, `PortfolioSecurity` entities, and their `Security` base. Rules, invariants and terms are in `docs/domain/portfolio-allocation.md` and `docs/domain/ubiquitous-language.md`.

- **Money and percentages are `decimal.js` `Decimal`s** (ADR-0003). Don't mix them with `number` arithmetic. Convert with `.toNumber()` only for presentation or validation. Share counts are integer `number`s.
- **Validation pattern** (ADR-0004):
  - Every constructor ends with `validateClassErrors(this, ThisClass)`. It only runs when `this.constructor === ThisClass` (identity, not name), so the most-derived constructor validates once, after every field is set. A subclass that skips this call is never validated.
  - Constraints on `Decimal` fields go on `protected get <field>Value(): number` getters, because class-validator can't inspect Decimals.
  - Decorators need `experimentalDecorators` (tsconfig), which tsx and Vitest both honour.
- **`Portfolio` constructor checks**, in order:
  1. decorator validation (non-empty, nested securities),
  2. target percentages sum to exactly 1 (`Decimal.equals`),
  3. a single currency,
  4. unique ticks.
- **Only `shares` changes after construction** (ADR-0021). Its setter throws on anything but a whole number ≥ 0, so a planning bug fails loudly. Every other field is `readonly`, and `Portfolio.securities` is a `readonly` array. Keep new fields `readonly`. Tests that need an invalid entity bypass this on purpose with `Object.assign`. Still validate use-case inputs and domain-operation arguments (as `balanceForPrice` does), so errors name the input rather than a share count.
- `initialShares` is the current holding and is never changed. `shares` is the proposed holding. Trade and fee values are derived from the difference between the two (ADR-0010). Keep both when adding derived values.
- `clone()` rebuilds through constructors, so validation runs again.
- Keep the worked examples in `docs/domain/use-cases.md` and the entity tests in sync when changing the math.
