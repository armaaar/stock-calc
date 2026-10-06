# Use Cases (application services)

Each CLI command, and the MCP tool of the same name, maps to one **application service** in `src/UseCases`. Every use case:

1. extends `PortfolioUseCase` and is built once with an `IPortfolioRepository` (by `createPortfolioUseCases`, wired in `src/compositionRoot.ts`),
2. receives a request naming the **portfolio type** on each `execute({ portfolioType, … })` call, and validates the rest of the request first,
3. loads the `Portfolio` aggregate through the repository,
4. optionally changes the proposed `shares` (the initial state is never changed),
5. returns the aggregate for the interface to present.

Use cases hold no state between calls and persist nothing.

## Summary

| Use case | CLI command | MCP tool and inputs | Domain operation | Presented as |
| --- | --- | --- | --- | --- |
| [Show current portfolio](#uc-1-show-current-portfolio) | `show` | `show` | none | `ONLY_INITIAL` |
| [Rebalance](#uc-2-rebalance-portfolio) | `rebalance` | `rebalance` | `allocateCash(0)` | `WITH_DELTA` |
| [Invest additional amount](#uc-3-invest-an-additional-amount) | `invest <investment>` | `invest { investment }` | `allocateCash(investment)` | `WITH_DELTA` |
| [Allocate to a target value](#uc-4-allocate-to-a-target-value) | `target <price>` | `target { price > 0 }` | `allocateValue(price)` | `WITH_DELTA` |
| [Find minimal portfolio](#uc-5-find-the-minimal-portfolio) | `minimal [-p] [-s]` | `minimal { precision ∈ (0,1], sharesStep ≥ 1 integer }` | iterative search | `ONLY_NEW` |

Every command takes `--pt, --portfolio <type>`, and every tool takes a `portfolio` input. Both default to `EUR`. **Actor:** the investor, running the CLI locally or asking an AI assistant connected to the MCP server.

**Shared preconditions:** `src/data/_settings.<type>.jsonc` exists and passes validation, every security can be priced ([Market Data](market-data.md)), and the aggregate invariants hold ([Portfolio Allocation](portfolio-allocation.md#invariants-checked-at-construction)). If any of these fails, the CLI prints the error(s) and exits with code 1, the MCP tool returns an `isError` result, and no plan is produced.

**Worked examples** below use the tracked example portfolio (`_settings.EUR.jsonc.example` with `_overrides.EUR.jsonc.example`): QDVE at 28.45 EUR (target 40%, 100 held) and SPYD at 62.10 EUR (target 60%, 100 held), with a flat fee of 1 EUR per order.

---

## UC-1: Show current portfolio

**Class:** `GetCurrentPortfolioUseCase` · **Command:** `npm run cli -- show`

**Intent:** see current holdings, their value, and how far each weight has drifted from target.

**Flow:** load the portfolio and return it unchanged.

**Output:** for each security, initial shares, value, and actual vs target percentage, plus the total value of current holdings and the cash held.

**Example:** QDVE is 31.42% (target 40%) and SPYD is 68.58% (target 60%). Portfolio value is 9055 EUR.

---

## UC-2: Rebalance portfolio

**Class:** `GetRebalancedPortfolioUseCase` · **Command:** `npm run cli -- rebalance`

**Intent:** restore target weights using only the money already in the portfolio (holdings and cash held), by selling overweight positions and buying underweight ones.

**Flow:**
1. Load the portfolio.
2. `allocateCash(0)`:
   - balance to `V = holdings + cash` (for each security, `shares = round(V × target ÷ price)`);
   - then trim until the trades and fees need no new money.

**Postconditions:** proposed weights are as close to target as whole shares allow. `cashAfterTrades ≥ 0`: the rebalance pays for its own fees.

**Output:** proposed and traded shares, trade value, and fee per security, plus total fee, net traded value, proposed portfolio value, and cash after trades.

**Example:** buy 27 QDVE (+768.15) and sell 13 SPYD (−807.30). Fees 2 EUR, net traded value −39.15 EUR, giving 40.08% / 59.92%, with 37.15 EUR cash after trades.

**Notes:** rounding usually leaves a little cash over (here 39.15 EUR released, minus 2 EUR fees). If the portfolio holds cash, the rebalance invests it too.

---

## UC-3: Invest an additional amount

**Class:** `GetPortfolioWithInvestmentUseCase` · **Command:** `npm run cli -- invest <investment>`

**Intent:** deploy new money while moving toward target weights.

**Flow:**
1. Load the portfolio.
2. `allocateCash(investment)`:
   - balance to `holdings + cash + investment`;
   - then trim, cancelling buys first, until the trades and fees fit in `cash + investment`.

**Postconditions:** proposed weights are as close to target as whole shares allow, and `cashAfterTrades ≥ 0`. The plan never needs more than the investment plus the cash held, fees included.

**Example (`invest 1000`):** buy 41 QDVE (+1166.45) and **sell 3 SPYD** (−186.30). Net 980.15 EUR, fees 2 EUR, new value 10035.15 EUR, 17.85 EUR cash after trades.

**Example (`invest 2`):** rounding alone would buy 27 QDVE and sell 12 SPYD, needing 24.95 EUR. The plan cancels one QDVE buy instead: buy 26 QDVE, sell 12 SPYD, leaving 5.50 EUR.

**Notes:**
- This is "invest **and** rebalance". If a position is overweight enough, the plan sells it even though money is being added. There's no "buy-only" mode.
- Cash needed (net traded + fees) is never above `investment` + cash held. What's left over is reported as cash after trades.
- Negative amounts plan a withdrawal: `invest -4055` gives the same plan as `target 5000`. A withdrawal larger than the portfolio's value (holdings + cash) fails with `Cannot withdraw <amount>: more than the portfolio value (<value>)`. A withdrawal must also cover the sell fees, so the plan sells enough to pay for them. Withdrawing exactly the whole value plans selling everything, and cash after trades shows the fees as a shortfall (−2 EUR in the example).
- The investment must be a finite number. The CLI rejects anything else while parsing arguments, the MCP schema rejects it, and the use case throws a `ClassValidatorError` (`Investment.amount`).

---

## UC-4: Allocate to a target value

**Class:** `GetPortfolioWithPriceUseCase` · **Command:** `npm run cli -- target <price>`

**Intent:** see what an allocation worth an absolute amount looks like, for example when building a portfolio from scratch with a fixed budget, or deciding how much to keep after a partial withdrawal.

**Flow:** load the portfolio, then `allocateValue(price)`: balance to `price`, then trim the most overweight holding until the proposed value is ≤ `price`. Current holdings don't affect the proposed shares; they're only used to compute the trades. Cash after trades shows the money released (or, if negative, needed), fees included.

**Example (`target 5000`):** sell 30 QDVE and 52 SPYD. Proposed value 4972.30 EUR (40.05% / 59.95%), fees 2 EUR.

**Notes:** the proposed value is never above `price`, and is usually within a share's price of it. For example, `target 156` gives QDVE 2 / SPYD 1 (119 EUR), because QDVE 2 / SPYD 2 would be worth 181.10 EUR. The price must be a finite number greater than 0. `target abc` is rejected while parsing CLI arguments, the MCP schema rejects it, and the use case throws a `ClassValidatorError` (`TargetPrice.amount`) for 0, negative, NaN or infinite values. To plan selling everything, use `invest` with minus the portfolio value.

---

## UC-5: Find the minimal portfolio

**Class:** `GetPortfolioWithMinimumSharesUseCase` · **Command:** `npm run cli -- minimal [-p <precision>] [-s <step>]`

**Intent:** find the smallest whole-share allocation whose actual weights are all within `precision` of their targets. This tells you the minimum capital needed to hold the portfolio at its intended weights.

**Inputs (validated by `MinimumSharesSearch` before the portfolio is loaded):**

| Input | Default | Constraint |
| --- | --- | --- |
| `precision` | 0.01 (±1 percentage point) | finite, 0 < p ≤ 1 |
| `sharesStep` | 1 | integer ≥ 1 |

**Flow:**
1. Load the portfolio.
2. While **not** every security satisfies `|actualPercentage − target| ≤ precision` (measured on the proposed state):
   1. Set the **first** security's shares to `n` (n = step, 2·step, 3·step, …).
   2. For every other security `i`, scale from the first one:
      `shares_i = roundToMultiple(round(price₀ × shares₀ ÷ target₀ × target_i ÷ price_i), step)`.
3. Return the portfolio.

**Example (default precision):** n = 1 gives 31.4% (fails), n = 2 gives 47.8% (fails), n = 3 gives QDVE 3 / SPYD 2 = 40.73% / 59.27%. Value 209.55 EUR. With `-p 0.001`: QDVE 16 / SPYD 11, value 1138.30 EUR.

**Notes and edge cases:**
- The search always starts from scratch (n = step, 2·step, …), so the result never depends on current holdings. It's presented as a target state only (`ONLY_NEW`, with no trades or fees).
- The **first security with a target above 0** drives the search. Securities with a 0 target get 0 shares.
- Only an omitted precision or shares step gets the default. Precision must be finite, > 0 and ≤ 1, and the shares step an integer ≥ 1. Anything else throws a `ClassValidatorError` (`MinimumSharesSearch.acceptablePrecision` / `sharesStep`).
- Smaller precision means more iterations and larger results. The search stops after `MAX_SEARCH_ITERATIONS` (100,000) with `No portfolio within precision <p> found in <n> iterations`.

---

## Adding a use case

1. Create `src/UseCases/<Name>.UseCase.ts` extending `PortfolioUseCase<<Name>Request>` and implement `execute(request)`. Load the portfolio with `this.portfolioRepo.getPortfolio(portfolioType)`.
2. Express the calculation as a method on the `Portfolio` aggregate when possible (as `balanceForPrice` is), so use cases stay thin.
3. If the request has constrained values, put them in a small value class whose decorated fields are checked by `validateClassErrors(this, <Class>)` at the end of its constructor ([ADR-0004](../architecture/adr/0004-self-validating-entities.md)), and build it first thing in `execute`, so bad input fails before anything is loaded.
4. Add it to `PortfolioUseCases` and `createPortfolioUseCases` (`src/UseCases/PortfolioUseCases.factory.ts`).
5. Wire up a CLI command and an MCP tool (see the [architecture overview](../architecture/overview.md#extension-points)) and add it to this document.
