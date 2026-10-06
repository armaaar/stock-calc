# ADR-0004: Self-validating entities with class-validator

- **Status:** Accepted
- **Date:** 2023-09-10
- **Amended by:** [ADR-0021](0021-guard-proposed-shares.md) (every change to `shares` is checked; other fields are read-only)
- **Introduced in:** `4d56948` (dependency added), `e79fe62` "feat: add more options and validations"

## Context

Domain objects are built from user-edited files and CLI arguments. Invalid values, such as negative prices, fractional share counts, or percentages above 100%, should fail fast with a clear message instead of producing nonsense allocations. The entities form an inheritance chain (`Security` → `PortfolioSecurity`), and a base-class constructor runs before the subclass has assigned its own fields.

## Decision

We will declare constraints with `class-validator` decorators on entity properties, and on use-case parameters where needed. Each constructor ends with:

```ts
validateClassErrors(this, ThisClass)
```

`validateClassErrors` (`src/Shared/ClassValidatorError.ts`) runs only when `this.constructor === ThisClass` (compared by name until 2026-10-06, when it changed to identity so that an unrelated class with the same name is never matched). So an object is validated exactly once, by the most-derived constructor, after all fields are set. On failure it throws a `ClassValidatorError` carrying the `ValidationError[]`, which `ErrorCliPresenter` renders as tables.

Constraints on `Decimal` fields are placed on `protected get <field>Value(): number` getters, because the validators work on primitives ([ADR-0003](0003-decimal-arithmetic.md)).

Aggregate-level rules that can't be expressed as a decorator, such as "percentages sum to 1" and "single currency", are checked explicitly in the `Portfolio` constructor and throw a plain `Error`.

## Consequences

- An entity can't be constructed in an invalid state, and `clone()` re-runs validation because it goes through the constructor.
- Validation happens **only at construction**. Later mutation of `shares` by use cases is not re-validated. For example, `target abc` yields `NaN` share counts without an error.
- Every new entity or validated use case must follow the "validate at the end of the constructor" pattern, or its decorators have no effect.

> **Update:** [ADR-0021](0021-guard-proposed-shares.md) checks every assignment to `shares` and makes the other entity fields read-only, so the "only at construction" consequence above no longer holds.

> **Update:** `src/__tests__/validationGuard.test.ts` now enforces the "validate at the end of the constructor" pattern. It fails when a class with class-validator decorators, or a subclass of one, doesn't call `validateClassErrors(this, <itself>)`.
