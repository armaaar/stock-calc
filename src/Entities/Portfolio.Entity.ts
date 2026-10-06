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

    // Rounding and fees can overshoot: cancel buys first, and only sell more when buying nothing
    // still needs more cash than there is. Selling everything ends the loop: if even that falls
    // short, cashAfterTrades stays negative and shows by how much.
    while (this.cashAfterTrades.lessThan(0)) {
      const buys = this.securities.filter((sec) => sec.shares > sec.initialShares)
      const held = this.securities.filter((sec) => sec.shares > 0)
      const sec = this.mostOverweight(buys.length > 0 ? buys : held)
      if (!sec) return
      sec.shares -= 1
    }
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
    })
    copy.plannedDeposit = this.plannedDeposit
    return copy
  }
}
