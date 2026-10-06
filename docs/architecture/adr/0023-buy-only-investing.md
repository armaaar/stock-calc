# ADR-0023: Buy-only investing by water-filling the underweight holdings

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

`invest` always rebalances as well ([ADR-0022](0022-plans-stay-within-available-cash.md)), so it can plan sells while money is being added. A sell costs a fee and can have tax consequences. Investors who contribute regularly usually want new money to only **buy**, steering the portfolio back toward its targets without selling anything.

## Decision

- `invest` takes an optional **buy-only** flag: `--buy-only` / `-b` on the CLI, `buyOnly` in the MCP tool. It defaults to off. A buy-only investment must be ≥ 0. `Investment` rejects a negative one (`buyOnlyAmount`) before the portfolio is loaded.
- The domain operation is `Portfolio.buyWithCash(deposit)`. It spends `cash + deposit` and never sells:
  1. **Water-filling.** It finds the portfolio value `L` up to which the money lifts the underweight securities. Each security with a target and a price above 0 gets `max(0, L × target − current value)`. The most underweight security is filled first, and others join as `L` rises past their current weight. Overweight securities get nothing.
  2. Each buy is **rounded down** to whole shares, so rounding never overspends.
  3. If the fees still overshoot, it cancels one share of the most overweight buy at a time.
  4. **Remainder.** It spends the money left over one share at a time on the most underweight security that still fits, fees included, until nothing fits.
- Like every plan, the result reports `cashAfterTrades ≥ 0`.

## Consequences

- Regular contributions move the portfolio toward its targets with no sells. For example, 1000 into the example portfolio buys 35 QDVE and leaves 3.25 EUR.
- A buy-only plan converges more slowly than a full rebalance when a holding is far overweight, because only new money corrects the drift.
- The remainder step can add a small order, and with it a flat fee, to use up the last of the money. The fee-share warning makes such orders visible.
