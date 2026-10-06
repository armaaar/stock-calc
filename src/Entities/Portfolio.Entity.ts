import {
  ArrayNotEmpty, IsArray, IsNumber, Min, ValidateNested,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PortfolioSecurity } from './PortfolioSecurity.Entity'

export interface IPortfolio {
  securities: readonly PortfolioSecurity[]
  /** Uninvested cash held with the holdings, in the portfolio's currency; default 0. */
  cash?: number
}

export class Portfolio {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  public readonly securities: readonly PortfolioSecurity[]

  public readonly currency?: string

  /** Uninvested cash held now. */
  public readonly cash: Decimal

  @IsNumber()
  @Min(0)
  protected get cashValue(): number {
    return this.cash.toNumber()
  }

  private plannedDeposit = new Decimal(0)

  constructor({
    securities, cash = 0,
  }: IPortfolio) {
    // A frozen copy: changing the caller's array later can't add, remove or swap securities
    this.securities = Object.freeze([...securities])
    this.currency = securities[0]?.currency
    this.cash = new Decimal(cash)

    validateClassErrors(this, Portfolio)

    const totalPercentage = securities.reduce(
      (acc, sec) => acc.plus(sec.targetPercentage),
      new Decimal(0),
    )
    if (!totalPercentage.equals(1)) {
      throw Error(`Portfolio percentage don't add up to 1 (${totalPercentage})`)
    }

    if (!securities.every((sec) => sec.currency === this.currency)) {
      throw Error('Portfolio have securities with different currencies')
    }

    const ticks = securities.map((sec) => sec.tick)
    const duplicateTicks = [...new Set(ticks.filter((tick, i) => ticks.indexOf(tick) !== i))]
    if (duplicateTicks.length > 0) {
      throw Error(`Portfolio has duplicate ticks (${duplicateTicks.join(', ')})`)
    }
  }

  public get totalPrice(): Decimal {
    return this.securities.reduce(
      (acc, sec) => acc.plus(sec.totalPrice),
      new Decimal(0),
    )
  }

  public get initialTotalPrice(): Decimal {
    return this.securities.reduce(
      (acc, sec) => acc.plus(sec.initialTotalPrice),
      new Decimal(0),
    )
  }

  public get totalTradedPrice(): Decimal {
    return this.totalPrice.minus(this.initialTotalPrice)
  }

  public get totalTradingFee(): Decimal {
    return this.securities.reduce(
      (acc, sec) => acc.plus(sec.tradingFee),
      new Decimal(0),
    )
  }

  /** Money the plan adds to the portfolio (negative: withdraws). Set by `allocateCash`. */
  public get deposit(): Decimal {
    return this.plannedDeposit
  }

  /**
   * Cash left once the plan is carried out: cash held + deposit − net traded value − fees.
   * Negative means the plan needs that much more money than it was given.
   */
  public get cashAfterTrades(): Decimal {
    return this.cash
      .plus(this.plannedDeposit)
      .minus(this.totalTradedPrice)
      .minus(this.totalTradingFee)
  }

  /** Rounds each security to the whole number of shares nearest its share of `price`. */
  public balanceForPrice(price: Decimal) {
    if (!price.isFinite() || price.lessThan(0)) {
      throw Error(`Portfolio price must be a finite number of at least 0 (${price})`)
    }

    for (let i = 0; i < this.securities.length; i++) {
      const sec = this.securities[i]
      const secTargetPrice = price.times(sec.targetPercentage)
      sec.shares = secTargetPrice.dividedBy(sec.price).round().toNumber()
    }
  }

  /**
   * Moves toward the targets using the cash held plus `deposit` (negative to withdraw), so
   * that the trades and their fees never need more cash than that.
   */
  public allocateCash(deposit: Decimal) {
    if (!deposit.isFinite()) {
      throw Error(`Deposit must be a finite number (${deposit})`)
    }
    const value = this.initialTotalPrice.plus(this.cash).plus(deposit)
    if (value.lessThan(0)) {
      throw Error(
        `Cannot withdraw ${deposit.negated()}: more than the portfolio value (${this.initialTotalPrice.plus(this.cash)})`,
      )
    }

    this.plannedDeposit = deposit
    this.balanceForPrice(value)

    // Rounding and fees can overshoot: cancel buys first
    this.cancelBuysUntilAffordable()

    const hasBuys = this.securities.some((sec) => sec.shares > sec.initialShares)
    if (!hasBuys && deposit.plus(this.cash).greaterThanOrEqualTo(0)) {
      // Sells only fund buys or a withdrawal: without either they just turn holdings into fees
      this.resetShares()
      return
    }

    // A withdrawal that the sells and fees don't cover yet: raise more by selling
    this.sellUntilAffordable()
  }

  private resetShares() {
    this.securities.forEach((sec) => {
      sec.shares = sec.initialShares
    })
  }

  /**
   * Cancels buys, most overweight first, until the plan needs no more cash than it has or no
   * buys are left. Far short, it cancels several shares at once, so large fees stay fast.
   */
  private cancelBuysUntilAffordable() {
    while (this.cashAfterTrades.lessThan(0)) {
      const buys = this.securities.filter((sec) => sec.shares > sec.initialShares)
      const sec = this.mostOverweight(buys)
      if (!sec) return
      sec.shares -= this.sharesToRemove(sec, buys.length, sec.shares - sec.initialShares)
    }
  }

  /**
   * Sells until the plan is affordable. It undoes any sell that costs more in fees than it
   * raises, and only takes steps that raise cash. If nothing does, cashAfterTrades stays
   * negative and shows the shortfall.
   */
  private sellUntilAffordable() {
    while (this.cashAfterTrades.lessThan(0)) {
      const losing = this.securities.find((sec) => (
        sec.shares < sec.initialShares && sec.tradingFee.greaterThanOrEqualTo(sec.tradedPrice.abs())
      ))
      if (losing) {
        losing.shares = losing.initialShares
        continue
      }

      const held = this.securities.filter((sec) => sec.shares > 0)
      const sec = this.mostOverweight(held.filter((other) => this.raisesCash(other, 1)))
      if (sec) {
        // Fees grow by at most the percentage of what's sold, so if one more share raises cash,
        // so do several
        sec.shares -= this.sharesToRemove(sec, held.length, sec.shares)
        continue
      }

      // One more share can't pay for a new order's fee; selling a whole holding still might
      const sellable = held.filter((other) => this.raisesCash(other, other.shares))
      const whole = this.mostOverweight(sellable)
      if (!whole) return
      whole.shares = 0
    }
  }

  /** Whether selling `shares` more of `sec` (or buying that many fewer) leaves more cash. */
  private raisesCash(sec: PortfolioSecurity, shares: number): boolean {
    const before = this.cashAfterTrades
    sec.shares -= shares
    const after = this.cashAfterTrades
    sec.shares += shares
    return after.greaterThan(before)
  }

  /**
   * How many shares of `sec` to take off at once: its share of the shortfall, split between the
   * `among` candidates, at least 1 and at most `max`.
   */
  private sharesToRemove(sec: PortfolioSecurity, among: number, max: number): number {
    const short = this.cashAfterTrades.negated()
    const step = short.dividedBy(sec.price.times(among)).floor().toNumber()
    return Math.min(max, Math.max(1, step))
  }

  /**
   * Spends the cash held plus `deposit` on buys only: nothing is sold. The most underweight
   * securities are brought up first, and the trades and fees never need more than that cash.
   */
  public buyWithCash(deposit: Decimal) {
    if (!deposit.isFinite() || deposit.lessThan(0)) {
      throw Error(`A buy-only deposit must be a finite number of at least 0 (${deposit})`)
    }

    this.plannedDeposit = deposit
    const buyable = this.securities.filter((sec) => (
      sec.targetPercentage.greaterThan(0) && sec.price.greaterThan(0)
    ))
    const level = this.fillLevel(buyable, this.cash.plus(deposit))
    this.resetShares()
    buyable.forEach((sec) => {
      const gap = level.times(sec.targetPercentage).minus(sec.initialTotalPrice)
      const buyValue = Decimal.max(0, gap)
      // Rounding down never spends more than the cash; fees are fitted below
      sec.shares += buyValue.dividedBy(sec.price).floor().toNumber()
    })

    // Fees can still overshoot: cancel buys of the most overweight security first. With no
    // sells, cancelling every buy always fits, since cash + deposit ≥ 0.
    this.cancelBuysUntilAffordable()

    // Spend what rounding left over, one share at a time, on whatever is most underweight
    let candidates = buyable
    while (candidates.length > 0) {
      const sec = this.mostUnderweight(candidates) as PortfolioSecurity
      sec.shares += 1
      if (this.cashAfterTrades.lessThan(0)) {
        sec.shares -= 1
        candidates = candidates.filter((other) => other !== sec)
      }
    }
  }

  /**
   * The portfolio value up to which `cash` can lift the buyable securities that are below their
   * target there (water-filling): each gets `level × target − its current value`, and those
   * already above that are left alone.
   */
  private fillLevel(buyable: PortfolioSecurity[], cash: Decimal): Decimal {
    // The value at which each security stops being overweight, lowest first
    const startLevel = (sec: PortfolioSecurity) => (
      sec.initialTotalPrice.dividedBy(sec.targetPercentage)
    )
    const ordered = [...buyable].sort((a, b) => startLevel(a).comparedTo(startLevel(b)))

    let value = new Decimal(0)
    let target = new Decimal(0)
    for (let i = 0; i < ordered.length; i++) {
      value = value.plus(ordered[i].initialTotalPrice)
      target = target.plus(ordered[i].targetPercentage)
      const level = cash.plus(value).dividedBy(target)
      const next = ordered[i + 1]
      if (!next || level.lessThanOrEqualTo(startLevel(next))) return level
    }
    return new Decimal(0)
  }

  /** Allocates holdings worth as close to `price` as whole shares allow, but never above it. */
  public allocateValue(price: Decimal) {
    this.balanceForPrice(price)

    while (this.totalPrice.greaterThan(price)) {
      // Above a price ≥ 0, some security has a positive value, so there is always one to trim
      const valued = this.securities.filter((sec) => sec.totalPrice.greaterThan(0))
      const sec = this.mostOverweight(valued) as PortfolioSecurity
      sec.shares -= 1
    }
  }

  /** The candidate whose proposed weight is furthest above its target (the first on a tie). */
  private mostOverweight(candidates: PortfolioSecurity[]): PortfolioSecurity | undefined {
    return this.furthestFromTarget(candidates, 1)
  }

  /** The candidate whose proposed weight is furthest below its target (the first on a tie). */
  private mostUnderweight(candidates: PortfolioSecurity[]): PortfolioSecurity | undefined {
    return this.furthestFromTarget(candidates, -1)
  }

  private furthestFromTarget(
    candidates: PortfolioSecurity[],
    direction: 1 | -1,
  ): PortfolioSecurity | undefined {
    const totalPrice = this.totalPrice
    const drift = (sec: PortfolioSecurity) => (
      sec.calcActualPercentage(totalPrice).minus(sec.targetPercentage).times(direction)
    )
    return candidates.reduce<PortfolioSecurity | undefined>(
      (best, sec) => (best === undefined || drift(sec).greaterThan(drift(best)) ? sec : best),
      undefined,
    )
  }

  public clone(): Portfolio {
    const copy = new Portfolio({
      securities: this.securities.map((sec) => sec.clone()),
      cash: this.cashValue,
    })
    copy.plannedDeposit = this.plannedDeposit
    return copy
  }
}
