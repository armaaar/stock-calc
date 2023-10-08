import { IsInt, Max, Min } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '@/Shared/ClassValidatorError'
import { ISecurety, Security } from './Security.Entity'

export interface IPortfolioSecurity extends ISecurety {
  shares: number
  initialShares?: number
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

  @IsInt()
  @Min(0)
  public initialShares: number

  constructor(args: IPortfolioSecurity) {
    super(args)
    this.shares = args.shares
    this.initialShares = args.initialShares ?? args.shares
    this.targetPercentage = new Decimal(args.targetPercentage)

    validateClassErrors(this, PortfolioSecurity)
  }

  public get isBeingTraded(): boolean {
    return this.shares !== this.initialShares
  }

  public get totalPrice(): Decimal {
    return this.price.times(this.shares)
  }

  public get initialTotalPrice(): Decimal {
    return this.price.times(this.initialShares)
  }

  public get tradedPrice(): Decimal {
    return this.totalPrice.minus(this.initialTotalPrice)
  }

  public calcActualPercentage(portfolioPrice: Decimal, securityPrice?: Decimal) {
    const price = securityPrice ?? this.totalPrice
    const actualPercentage = price.dividedBy(portfolioPrice)
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
      initialShares: this.initialShares,
      targetPercentage: this.targetPercentage.toNumber(),
    })
  }
}
