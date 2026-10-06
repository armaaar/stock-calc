# ADR-0022: Portfolios hold cash, and plans stay within the money available

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0011](0011-fee-model-per-security-order.md) (fees are now budgeted in `invest` and `rebalance`)

## Context

`balanceForPrice` rounds every security to the nearest whole share, and ADR-0011 made fees reported rather than budgeted. As a result:

- `invest X` could need more than `X`. Investing 2 in the example portfolio planned trades and fees needing 24.95.
- `rebalance` could need money that wasn't in the portfolio.
- `target X` could propose holdings worth more than `X`. A target of 156 gave holdings worth 181.10.
- Cash wasn't modelled at all. Uninvested cash at the broker was ignored, and a plan never said what would be left over after rounding and fees.

## Decision

- **A portfolio holds cash.** The settings file has an optional `cash` (≥ 0, in the portfolio's currency, default 0), and `Portfolio.cash` holds it.
- **`allocateCash(deposit)`** is the domain operation behind `invest` and `rebalance`. Rebalance is a deposit of 0. It works like this:
  1. It records the deposit (negative to withdraw).
  2. It balances to `holdings + cash + deposit` with `balanceForPrice`.
  3. It trims until `cashAfterTrades = cash + deposit − net traded − fees` is ≥ 0. It cancels one share of the most overweight **buy** at a time. Only when no buys are left does it sell one more share of the most overweight holding.
  4. If even selling everything falls short, which happens when a whole-value withdrawal also has to pay fees, the plan sells everything and `cashAfterTrades` stays negative by the shortfall.
- **`allocateValue(price)`** is the domain operation behind `target`. It balances, then trims the most overweight holding until the proposed value is ≤ `price`. The fees are cash paid on top of that value, and the plan reports them.
- **Every plan reports `cashAfterTrades`** ("Cash After Trades"). `show` reports the cash held. Negative means the plan needs that much more money than it was given.
- The planned deposit is plan state like `shares`. It can only be set through `allocateCash`, and the cash held is read-only ([ADR-0021](0021-guard-proposed-shares.md)).

## Consequences

- `invest X` never needs more than `X` plus the cash already held, fees included, and `rebalance` never needs new money. The worked examples are unchanged (rebalance 127 / 87, invest 1000 141 / 97, target 5000 70 / 48), because none of them overspent.
- Trimming is greedy (one share at a time, most overweight first). It isn't a globally optimal fit, but it is deterministic and leaves weights close to target.
- CLI output gains a "Cash" line (`show`) or a "Cash After Trades" line (plans). The MCP output gains `cash` / `cashAfterTrades`.
- `minimal` is unaffected. It searches for a target state from scratch and has no budget.
