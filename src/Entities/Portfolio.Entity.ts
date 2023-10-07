import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '@/Shared/ClassValidatorError'
import { PortfolioSecurity } from './PortfolioSecurity.Entity'

export class Portfolio {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  public securities: PortfolioSecurity[]

  public currency?: string

  constructor(securities: PortfolioSecurity[]) {
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

  public clone(): Portfolio {
    return new Portfolio(this.securities.map((sec) => sec.clone()))
  }
}
