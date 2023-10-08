import {
  ArrayNotEmpty, IsArray, ValidateNested,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '@/Shared/ClassValidatorError'
import { PortfolioSecurity } from './PortfolioSecurity.Entity'

export interface IPortfolio {
  securities: PortfolioSecurity[]
}

export class Portfolio {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  public securities: PortfolioSecurity[]

  public currency?: string

  constructor({
    securities,
  }: IPortfolio) {
    const totalPercentage = securities.reduce(
      (acc, sec) => acc.plus(sec.targetPercentage),
      new Decimal(0),
    )
    if (!totalPercentage.equals(1)) {
      throw Error(`Portfolio percentage don't add up to 1 (${totalPercentage})`)
    }

    if (!securities.every((sec) => sec.currency === securities[0].currency)) {
      throw Error('Portfolio have securities with different currencies')
    }

    this.securities = securities
    this.currency = securities[0].currency

    validateClassErrors(this, Portfolio)
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
