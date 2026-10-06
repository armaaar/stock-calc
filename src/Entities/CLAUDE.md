# src/Entities

The domain model: the `Portfolio` aggregate root, `PortfolioSecurity` entities, their `Security` base, the `PriceQuote` value object each security holds, and the `ExchangeRate` value object of a security quoted in another currency than the portfolio's. Rules, invariants and terms are in `docs/domain/portfolio-allocation.md` and `docs/domain/ubiquitous-language.md`.

- **Money and percentages are `decimal.js` `Decimal`s** (ADR-0003). Don't mix them with `number` arithmetic. Convert with `.toNumber()` only for presentation or validation. Share counts are integer `number`s.
- **Validation pattern** (ADR-0004):
  - Every constructor ends with `validateClassErrors(this, ThisClass)`. It only runs when `this.constructor === ThisClass` (identity, not name), so the most-derived constructor validates once, after every field is set. A subclass that skips this call is never validated, and `src/__tests__/validationGuard.test.ts` fails `npm test` when one does.
  - Constraints on `Decimal` fields go on `protected get <field>Value(): number` getters, because class-validator can't inspect Decimals.
  - Decorators need `experimentalDecorators` (tsconfig), which tsx and Vitest both honour.
- **`Portfolio` constructor checks**, in order:
  1. decorator validation (non-empty, nested securities),
  2. target percentages sum to exactly 1 (`Decimal.equals`),
  3. every (converted) price in the portfolio's currency (P3, ADR-0028),
  4. unique ticks.
- **Only the plan changes after construction** (ADR-0021, ADR-0022): each security's `shares`, whose setter throws on anything but a whole number ≥ 0 so a planning bug fails loudly, and the portfolio's private `plannedDeposit`, set only by `allocateCash` / `buyWithCash`. Every other field is `readonly`, and `Portfolio.securities` is a frozen array. Keep new fields `readonly`. Tests that need an invalid entity bypass this on purpose with `Object.assign`. Still validate use-case inputs and domain-operation arguments (as `balanceForPrice` does), so errors name the input rather than a share count.
- `initialShares` is the current holding and is never changed. `shares` is the proposed holding. Trade and fee values are derived from the difference between the two (ADR-0010). Keep both when adding derived values.
- `PortfolioSecurity.price` and `.currency` are in the portfolio's currency: the quote converted by `exchangeRate` when there is one. All planning maths uses them. `quote.price` / `quote.currency` are the listed ones; use them only to show the listing. `fxFee` (part of `tradingFee`) is charged only on converted securities.
- `clone()` rebuilds through constructors, so validation runs again.
- Plans must stay affordable: `allocateCash`, `buyWithCash` and `allocateValue` end with `cashAfterTrades ≥ 0` (or `totalPrice ≤ price`) whenever that's possible, and they trim in bulk when far short, so large fees stay fast. The random-portfolio test in `__tests__/Portfolio.Entity.test.ts` guards this. Keep it passing when changing the trimming.
- Keep the worked examples in `docs/domain/use-cases.md` and the entity tests in sync when changing the math.
