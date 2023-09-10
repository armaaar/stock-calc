import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator'
import { validateClassErrors } from '@/Shared/utils'
import { PortfolioSecurity } from './PortfolioSecurity.Entity'

export class Portfolio {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested()
  public securities: PortfolioSecurity[]

  public currency?: string

  constructor(securities: PortfolioSecurity[]) {
    const totalPercentage = securities.reduce((acc, sec) => acc + sec.targetPercentage, 0)
    if (totalPercentage !== 1) {
      throw Error('Portfolio percentage don\'t add up to 1')
    }

    if (!securities.every((sec) => sec.currency === securities[0].currency)) {
      throw Error('Portfolio have securities with different currencies')
    }

    this.securities = securities
    this.currency = securities[0].currency

    validateClassErrors(this, Portfolio)
  }

  public get totalPrice(): number {
    return this.securities.reduce((acc, sec) => acc + sec.totalPrice, 0)
  }
}
