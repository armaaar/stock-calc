import { IsInt, Max, Min } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '@/Shared/ClassValidatorError'
import { ISecurety, Security } from './Security.Entity'

export interface IPortfolioSecurity extends ISecurety {
  shares: number
  targetPercentage: number
}

export class PortfolioSecurity extends Security {
  public targetPercentage: Decimal

  @Min(0)
  @Max(1)
  private get targetPercentageValue(): number {
    return this.targetPercentage.toNumber()
  }

  @IsInt()
  @Min(0)
  public shares: number

  constructor(args: IPortfolioSecurity) {
    super(args)
    this.shares = args.shares
    this.targetPercentage = new Decimal(args.targetPercentage)

    validateClassErrors(this, PortfolioSecurity)
  }

  public get totalPrice(): Decimal {
    return this.price.times(this.shares)
  }

  public calcActualPercentage(actualPrice: Decimal) {
    const actualPercentage = this.totalPrice.dividedBy(actualPrice)
    return actualPercentage.isNaN() ? new Decimal(0) : actualPercentage
  }

  public clone(): PortfolioSecurity {
    return new PortfolioSecurity({
      tick: this.tick,
      isin: this.isin,
      price: this.price.toNumber(),
      exchange: this.exchange,
      currency: this.currency,
      shares: this.shares,
      targetPercentage: this.targetPercentage.toNumber(),
    })
  }
}
