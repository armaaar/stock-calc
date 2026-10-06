import {
  IsInt, Max, Min, ValidateIf,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { ISecurety, Security } from './Security.Entity'

export interface IPortfolioSecurity extends ISecurety {
  shares: number
  initialShares?: number
  targetPercentage: number
  brokerageFeeFlat?: number
  tradingFeePercentage?: number
  minimumTradingFeeFlat?: number
}

export class PortfolioSecurity extends Security {
  public targetPercentage: Decimal

  @Min(0)
  @Max(1)
  protected get targetPercentageValue(): number {
    return this.targetPercentage.toNumber()
  }

  public brokerageFeeFlat: Decimal

  @Min(0)
  protected get brokerageFeeFlatValue(): number {
    return this.brokerageFeeFlat.toNumber()
  }

  public tradingFeePercentage: Decimal

  @Min(0)
  @Max(1)
  protected get tradingFeePercentageValue(): number {
    return this.tradingFeePercentage.toNumber()
  }

  public minimumTradingFeeFlat: Decimal

  @Min(0)
  protected get minimumTradingFeeFlatValue(): number {
    return this.minimumTradingFeeFlat.toNumber()
  }

  @IsInt()
  @Min(0)
  public shares: number

  // initialShares defaults to shares; validating an equal value again would report one
  // problem twice.
  @ValidateIf((sec: PortfolioSecurity) => sec.initialShares !== sec.shares)
  @IsInt()
  @Min(0)
  public initialShares: number

  constructor(args: IPortfolioSecurity) {
    super(args)
    this.shares = args.shares
    this.initialShares = args.initialShares ?? args.shares
    this.targetPercentage = new Decimal(args.targetPercentage)

    this.brokerageFeeFlat = new Decimal(args.brokerageFeeFlat ?? 0)
    this.tradingFeePercentage = new Decimal(args.tradingFeePercentage ?? 0)
    this.minimumTradingFeeFlat = new Decimal(args.minimumTradingFeeFlat ?? 0)

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

  public get tradingFee(): Decimal {
    if (!this.isBeingTraded) return new Decimal(0)

    // Sells are orders too: the percentage applies to the order's value either way
    const percentageFee = this.tradingFeePercentage.times(this.tradedPrice.abs())
    const variableFee = percentageFee.greaterThan(this.minimumTradingFeeFlat)
      ? percentageFee
      : this.minimumTradingFeeFlat

    return this.brokerageFeeFlat.add(variableFee)
  }

  public calcActualPercentage(portfolioPrice: Decimal, securityPrice?: Decimal) {
    if (portfolioPrice.isZero()) return new Decimal(0)

    const price = securityPrice ?? this.totalPrice
    return price.dividedBy(portfolioPrice)
  }

  public clone(): PortfolioSecurity {
    return new PortfolioSecurity({
      tick: this.tick,
      isin: this.isin,
      price: this.priceValue,
      exchange: this.exchange,
      currency: this.currency,
      shares: this.shares,
      initialShares: this.initialShares,
      targetPercentage: this.targetPercentageValue,
      brokerageFeeFlat: this.brokerageFeeFlatValue,
      tradingFeePercentage: this.tradingFeePercentageValue,
      minimumTradingFeeFlat: this.minimumTradingFeeFlatValue,
    })
  }
}
