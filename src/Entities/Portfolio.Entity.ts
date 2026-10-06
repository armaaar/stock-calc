import {
  ArrayNotEmpty, IsArray, ValidateNested,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PortfolioSecurity } from './PortfolioSecurity.Entity'

export interface IPortfolio {
  securities: readonly PortfolioSecurity[]
}

export class Portfolio {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  public readonly securities: readonly PortfolioSecurity[]

  public readonly currency?: string

  constructor({
    securities,
  }: IPortfolio) {
    // A frozen copy: changing the caller's array later can't add, remove or swap securities
    this.securities = Object.freeze([...securities])
    this.currency = securities[0]?.currency

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

  public clone(): Portfolio {
    return new Portfolio({
      securities: this.securities.map((sec) => sec.clone()),
    })
  }
}
