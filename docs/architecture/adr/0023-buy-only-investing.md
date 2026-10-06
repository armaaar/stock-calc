# ADR-0023: Buy-only investing by water-filling the underweight holdings

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

`invest` always rebalances as well ([ADR-0022](0022-plans-stay-within-available-cash.md)), so it can plan sells while money is being added. A sell costs a fee and can have tax consequences. Investors who contribute regularly usually want new money to only **buy**, steering the portfolio back toward its targets without selling anything.

## Decision

- `invest` takes an optional **buy-only** flag: `--buy-only` / `-b` on the CLI, `buyOnly` in the MCP tool. It defaults to off. A buy-only investment must be ≥ 0. `Investment` rejects a negative one (`buyOnlyAmount`) before the portfolio is loaded.
- The domain operation is `Portfolio.buyWithCash(deposit)`. It spends `cash + deposit` and never sells:
  1. **Water-filling.** It finds the portfolio value `L` up to which the money lifts the underweight securities. Each security with a target and a price above 0 gets `max(0, L × target − current value)`. The most underweight security is filled first, and others join as `L` rises past their current weight. Overweight securities get nothing.
  2. Each buy is rounded to the **nearest** whole share. That way an expensive security just short of one share's worth isn't skipped, which would leave its money to pile into cheaper, already overweight ones.
  3. If rounding up or fees overshoot, it cancels buys: each step cancels just enough shares of one buy to cover the shortfall (or the whole buy), choosing the buy whose cancellation leaves the weights closest to target (least Σ squared drift). A cheap share often covers a small shortfall better than an expensive one.
  4. **Remainder.** It spends what's left only on securities still at least half a share below their target, measured against the holdings plus the remaining cash. The most underweight goes first, several shares at a time when far short (halving the count while the fee makes it too many), as long as the plan can pay for them with fees. A security already over its target never gets the remainder.
- Like every plan, the result reports `cashAfterTrades ≥ 0`.

## Consequences

- Regular contributions move the portfolio toward its targets with no sells. For example, 1000 into the example portfolio buys 35 QDVE and leaves 3.25 EUR.
- A buy-only plan converges more slowly than a full rebalance when a holding is far overweight, because only new money corrects the drift.
- The remainder step can add a small order, and with it a flat fee, to use up the last of the money. The fee-share warning ([ADR-0024](0024-warn-about-expensive-orders.md)) points such orders out.
