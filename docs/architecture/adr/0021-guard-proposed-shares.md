# ADR-0021: Check every change to the proposed shares, and make the rest of the aggregate read-only

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0004](0004-self-validating-entities.md) (validation no longer happens only at construction)

## Context

ADR-0004 validates entities once, at the end of their constructor. Afterwards, use cases plan by assigning `PortfolioSecurity.shares` directly, and every other field (prices, targets, fees, the securities list) was publicly writable too. Nothing checked the invariants after construction. A planning bug could produce `NaN`, negative or fractional share counts, and the plan would be presented without an error. Use-case inputs were validated to keep known paths safe, but the aggregate itself didn't protect its rules.

Only one value is meant to change after construction: the proposed `shares`. Everything else describes the portfolio as loaded.

## Decision

- `PortfolioSecurity.shares` is an accessor. Its setter throws `Shares of '<tick>' must be a whole number of at least 0 (<value>)` and keeps the previous value. Invariant S1 therefore holds after every planning step, not just at construction.
- The constructor stores the initial value directly, so a bad value in the input is still reported as a `ClassValidatorError` together with any other field errors (ADR-0004).
- Every other entity field is `readonly`: `Security` identity and quote, `initialShares`, `targetPercentage`, the fee parts, and `Portfolio.securities` (a `readonly` array) and `currency`. The compiler rejects any attempt to change them. P1–P5 and S2–S5 can only be broken by bypassing the type system.

## Consequences

- No use case can return a plan with impossible share counts. A bug fails loudly and names the security.
- Tests that need an invalid entity, to check how validation errors are reported, have to bypass `readonly` on purpose with `Object.assign`.
- `readonly` is a compile-time guarantee only. tsx doesn't type-check, so `npm run typecheck` is what enforces it.
