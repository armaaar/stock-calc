import {
  ArrayNotEmpty, IsArray, IsNumber, Max, Min, ValidateNested,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PortfolioSecurity } from './PortfolioSecurity.Entity'

export interface IPortfolio {
  securities: readonly PortfolioSecurity[]
  /** Uninvested cash held with the holdings, in the portfolio's currency; default 0. */
  cash?: number
  /** Warn about an order whose fee is more than this fraction of its value; default 0.01. */
  feeWarningPercentage?: number
}

export const DEFAULT_FEE_WARNING_PERCENTAGE = 0.01

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

  /** Orders whose fee is more than this fraction of their value are flagged as expensive. */
  public readonly feeWarningPercentage: Decimal

  @IsNumber()
  @Min(0)
  @Max(1)
  protected get feeWarningPercentageValue(): number {
    return this.feeWarningPercentage.toNumber()
  }

  private plannedDeposit = new Decimal(0)

  constructor({
    securities, cash = 0, feeWarningPercentage = DEFAULT_FEE_WARNING_PERCENTAGE,
  }: IPortfolio) {
    // A frozen copy: changing the caller's array later can't add, remove or swap securities
    this.securities = Object.freeze([...securities])
    this.currency = securities[0]?.currency
    this.cash = new Decimal(cash)
    this.feeWarningPercentage = new Decimal(feeWarningPercentage)

    validateClassErrors(this, Portfolio)

    const totalPercentage = securities.reduce(
      (acc, sec) => acc.plus(sec.targetPercentage),
      new Decimal(0),
    )
    if (!totalPercentage.equals(1)) {
      throw Error(`Portfolio percentage don't add up to 1 (${totalPercentage})`)
    }

    if (!securities.every((sec) => sec.currency === this.currency)) {
      const quotes = securities.map((sec) => `${sec.tick}: ${sec.currency ?? 'unknown'}`)
      throw Error(
        `Portfolio has securities in different currencies (${quotes.join(', ')}). `
        + 'Price them all in one currency, for example with a price override',
      )
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

  /** The planned orders whose fee is more than `feeWarningPercentage` of their value. */
  public get expensiveOrders(): PortfolioSecurity[] {
    return this.securities.filter((sec) => sec.feeShare.greaterThan(this.feeWarningPercentage))
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

    // Rounding and fees can overshoot: cancel buys, or sell a little more, whichever lands closer
    this.fitToCash()

    if (!this.isWithdrawal && this.securities.every((sec) => sec.shares <= sec.initialShares)) {
      // Sells only fund buys or a withdrawal: without either they just turn holdings into fees
      this.resetShares()
      return
    }

    // A withdrawal still short: sell more, only what it needs
    this.sellUntilAffordable()
    // A sell whose fee eats what it raises only loses money; dropping it leaves more cash
    this.securities
      .filter((sec) => sec.shares < sec.initialShares)
      .filter((sec) => sec.tradingFee.greaterThanOrEqualTo(sec.tradedPrice.abs()))
      .forEach((sec) => {
        sec.shares = sec.initialShares
      })
  }

  /** Whether the plan takes money out: the cash held plus the deposit is below 0. */
  private get isWithdrawal(): boolean {
    return this.cash.plus(this.plannedDeposit).lessThan(0)
  }

  private resetShares() {
    this.securities.forEach((sec) => {
      sec.shares = sec.initialShares
    })
  }

  /**
   * Makes the plan affordable, one step at a time. The candidate steps are:
   * - cancelling, for each buy, just enough shares to cover the shortfall (or the whole buy);
   * - selling, for each security already being sold, the fewest more shares that cover it.
   *
   * It keeps the step that leaves the weights closest to target, preferring a cancel on a tie.
   * When cancelling the last buy, it judges the state the plan falls back to: the current
   * holdings, unless it's a withdrawal. Stops when no step is left.
   */
  private fitToCash() {
    while (this.cashAfterTrades.lessThan(0)) {
      const short = this.cashAfterTrades.negated()
      const options: { sec: PortfolioSecurity, count: number }[] = []
      this.securities.forEach((sec) => {
        if (sec.shares > sec.initialShares) {
          // A share cancelled saves its price and its part of a percentage fee
          const saving = Decimal.max(this.cashChange(sec, 1), sec.price)
          const toCover = short.dividedBy(saving).ceil().toNumber()
          const count = Math.min(sec.shares - sec.initialShares, Math.max(1, toCover))
          options.push({ sec, count })
        } else if (sec.shares < sec.initialShares) {
          const count = this.fewestSharesCovering(sec, short)
          if (count !== undefined) options.push({ sec, count })
        }
      })
      if (options.length === 0) return

      const scored = options.map((option) => ({ ...option, distance: this.distanceAfter(option) }))
      const best = scored.reduce((a, b) => (b.distance.lessThan(a.distance) ? b : a))
      best.sec.shares -= best.count
    }
  }

  /** How far from target the plan would be with `count` fewer shares of `sec`. */
  private distanceAfter({ sec, count }: { sec: PortfolioSecurity, count: number }): Decimal {
    sec.shares -= count
    // A plan left with no buys falls back to the holdings, unless it's a withdrawal
    const fallsBack = !this.isWithdrawal
      && this.securities.every((other) => other.shares <= other.initialShares)
    const distance = this.distanceFromTargets(fallsBack)
    sec.shares += count
    return distance
  }

  /**
   * Σ (actual weight − target weight)² over the proposed holdings, or over the current ones:
   * 0 when exactly on target.
   */
  private distanceFromTargets(current = false): Decimal {
    const totalPrice = current ? this.initialTotalPrice : this.totalPrice
    return this.securities.reduce((acc, sec) => {
      const value = current ? sec.initialTotalPrice : sec.totalPrice
      const drift = sec.calcActualPercentage(totalPrice, value).minus(sec.targetPercentage)
      return acc.plus(drift.times(drift))
    }, new Decimal(0))
  }

  /**
   * Sells for a withdrawal until the plan is affordable. It sells the fewest shares of one
   * holding that cover the shortfall, choosing the holding that leaves the weights closest to
   * target. When no single holding can cover it, it sells all of the one that raises the most
   * and goes on. If nothing raises cash, cashAfterTrades stays negative and shows the shortfall.
   */
  private sellUntilAffordable() {
    while (this.cashAfterTrades.lessThan(0)) {
      const short = this.cashAfterTrades.negated()
      const held = this.securities.filter((sec) => sec.shares > 0)

      const covering = held.flatMap((sec) => {
        const count = this.fewestSharesCovering(sec, short)
        return count === undefined ? [] : [{ sec, count }]
      })
      if (covering.length > 0) {
        const scored = covering.map((option) => (
          { ...option, distance: this.distanceAfter(option) }
        ))
        const best = scored.reduce((a, b) => (b.distance.lessThan(a.distance) ? b : a))
        best.sec.shares -= best.count
        return
      }

      const raising = held
        .map((sec) => ({ sec, gain: this.cashChange(sec, sec.shares) }))
        .filter(({ gain }) => gain.greaterThan(0))
      if (raising.length === 0) return
      const best = raising.reduce((a, b) => (b.gain.greaterThan(a.gain) ? b : a))
      best.sec.shares = 0
    }
  }

  /**
   * The fewest more shares of `sec` to sell for `short` more cash, fees included, or undefined
   * if selling all of them isn't enough. The cash raised never falls as more shares are sold
   * (a fee grows by at most its percentage of what's sold), so a binary search finds it.
   */
  private fewestSharesCovering(sec: PortfolioSecurity, short: Decimal): number | undefined {
    if (sec.shares === 0 || this.cashChange(sec, sec.shares).lessThan(short)) return undefined
    let low = 1
    let high = sec.shares
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (this.cashChange(sec, middle).greaterThanOrEqualTo(short)) high = middle
      else low = middle + 1
    }
    return low
  }

  /** How much more cash the plan leaves with `shares` fewer of `sec`. */
  private cashChange(sec: PortfolioSecurity, shares: number): Decimal {
    const before = this.cashAfterTrades
    sec.shares -= shares
    const after = this.cashAfterTrades
    sec.shares += shares
    return after.minus(before)
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
      // To the nearest share, so an expensive security isn't skipped for being just short of one
      sec.shares += Decimal.max(0, gap).dividedBy(sec.price).round().toNumber()
    })

    // Rounding up and fees can overshoot. With no sells, cancelling every buy always fits,
    // since cash + deposit ≥ 0.
    this.fitToCash()

    this.spendRemainder(buyable)
  }

  /**
   * Spends the cash left after a buy-only plan on the securities still below target, most
   * underweight first, measured against the holdings plus that cash. A security gets a share
   * only if it is at least half a share short, so the remainder never pushes one far over.
   */
  private spendRemainder(buyable: PortfolioSecurity[]) {
    let candidates = buyable
    for (;;) {
      const total = this.totalPrice.plus(this.cashAfterTrades)
      const shortOf = (sec: PortfolioSecurity) => (
        total.times(sec.targetPercentage).minus(sec.totalPrice)
      )
      candidates = candidates.filter((sec) => (
        shortOf(sec).greaterThanOrEqualTo(sec.price.dividedBy(2))
      ))
      if (candidates.length === 0) return

      const sec = candidates.reduce((a, b) => (shortOf(b).greaterThan(shortOf(a)) ? b : a))
      // Several shares at once when far short, so cheap shares don't take a step each
      const many = Decimal.min(shortOf(sec), this.cashAfterTrades)
        .dividedBy(sec.price).floor().toNumber()
      if (!this.tryBuy(sec, Math.max(1, many)) && !(many > 1 && this.tryBuy(sec, 1))) {
        candidates = candidates.filter((other) => other !== sec)
      }
    }
  }

  /** Buys `count` more shares of `sec` if the plan can still pay for them, fees included. */
  private tryBuy(sec: PortfolioSecurity, count: number): boolean {
    sec.shares += count
    if (this.cashAfterTrades.greaterThanOrEqualTo(0)) return true
    sec.shares -= count
    return false
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
    const totalPrice = this.totalPrice
    const drift = (sec: PortfolioSecurity) => (
      sec.calcActualPercentage(totalPrice).minus(sec.targetPercentage)
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
      feeWarningPercentage: this.feeWarningPercentageValue,
    })
    copy.plannedDeposit = this.plannedDeposit
    return copy
  }
}
