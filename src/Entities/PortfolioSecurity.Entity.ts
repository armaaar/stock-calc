import { IsInt, Max, Min } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '@/Shared/ClassValidatorError'
import { ISecurety, Security } from './Security.Entity'

interface IPortfolioSecurity extends ISecurety {
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
    return this.totalPrice.dividedBy(actualPrice)
  }
}
