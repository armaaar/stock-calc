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
     It then drops any planned sell whose fee is at least what it raises. Such a sell only loses money, and leaving it in would make the next steps sell more elsewhere to pay its fee.
  3. Until `cashAfterTrades = cash + deposit − net traded − fees` is ≥ 0, it takes one step at a time and keeps the step that leaves the weights closest to target (least Σ squared drift; a cancel on a tie):
     - **cancel** just enough shares of one buy to cover the shortfall (or the whole buy);
     - **sell** the fewest more shares of a security already being sold that cover it.

     A cheap share often covers a small shortfall better than an expensive one, and selling a little more of an overweight holding often beats skipping a buy over its fee. When cancelling the last buy of a plan that isn't a withdrawal, the step is judged by the current holdings, because that is what the plan falls back to.
  4. If no buys are left and `cash + deposit ≥ 0`, it plans **no trades**. Sells only exist to fund buys or a withdrawal. On their own they just turn holdings into fees.
  5. A withdrawal that is still short sells the **fewest** shares of one holding that cover the shortfall with fees, choosing the holding that leaves the weights closest to target. Only when no single holding can cover it does it sell a whole holding (the one raising the most) and go on. If nothing raises cash, for example a whole-value withdrawal that also has to pay fees, `cashAfterTrades` stays negative by the shortfall.
- **`allocateValue(price)`** is the domain operation behind `target`. It balances, then trims the most overweight holding until the proposed value is ≤ `price`. The fees are cash paid on top of that value, and the plan reports them.
- **Every plan reports `cashAfterTrades`** ("Cash After Trades"). `show` reports the cash held. Negative means the plan needs that much more money than it was given.
- The planned deposit is plan state like `shares`. It can only be set through `allocateCash` (and `buyWithCash`, [ADR-0023](0023-buy-only-investing.md)), and the cash held is read-only ([ADR-0021](0021-guard-proposed-shares.md)).

## Consequences

- `invest X` never needs more than `X` plus the cash already held, fees included, and `rebalance` never needs new money. The one exception is a withdrawal that even selling everything can't cover after fees, where `cashAfterTrades` shows the shortfall. The worked examples are unchanged (rebalance 127 / 87, invest 1000 141 / 97, target 5000 70 / 48), because none of them overspent.
- Trimming is greedy (one step at a time, in bulk, closest to target first). It isn't a globally optimal fit, but it is deterministic, fast, and leaves weights close to target.
- CLI output gains a "Cash" line (`show`) or a "Cash After Trades" line (plans). The MCP output gains `cash` / `cashAfterTrades`.
- `minimal` is unaffected. It searches for a target state from scratch and has no budget.
