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
  public readonly targetPercentage: Decimal

  @Min(0)
  @Max(1)
  protected get targetPercentageValue(): number {
    return this.targetPercentage.toNumber()
  }

  public readonly brokerageFeeFlat: Decimal

  @Min(0)
  protected get brokerageFeeFlatValue(): number {
    return this.brokerageFeeFlat.toNumber()
  }

  public readonly tradingFeePercentage: Decimal

  @Min(0)
  @Max(1)
  protected get tradingFeePercentageValue(): number {
    return this.tradingFeePercentage.toNumber()
  }

  public readonly minimumTradingFeeFlat: Decimal

  @Min(0)
  protected get minimumTradingFeeFlatValue(): number {
    return this.minimumTradingFeeFlat.toNumber()
  }

  private proposedShares: number

  /** The proposed holding. Planning changes it, so every change is checked (invariant S1). */
  @IsInt()
  @Min(0)
  public get shares(): number {
    return this.proposedShares
  }

  public set shares(shares: number) {
    if (!Number.isInteger(shares) || shares < 0) {
      throw Error(`Shares of '${this.tick}' must be a whole number of at least 0 (${shares})`)
    }
    this.proposedShares = shares
  }

  // initialShares defaults to shares; validating an equal value again would report one
  // problem twice.
  @ValidateIf((sec: PortfolioSecurity) => sec.initialShares !== sec.shares)
  @IsInt()
  @Min(0)
  public readonly initialShares: number

  constructor(args: IPortfolioSecurity) {
    super(args)
    // Not through the setter: a bad value is reported with the other validation errors below
    this.proposedShares = args.shares
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

  /**
   * The order's fee as a fraction of its value: 0.012 when 3 is paid to trade 250. It is 0 when
   * nothing is traded, or when the order has no value to compare the fee with.
   */
  public get feeShare(): Decimal {
    const orderValue = this.tradedPrice.abs()
    if (orderValue.isZero()) return new Decimal(0)
    return this.tradingFee.dividedBy(orderValue)
  }

  public calcActualPercentage(portfolioPrice: Decimal, securityPrice?: Decimal) {
    if (portfolioPrice.isZero()) return new Decimal(0)

    const price = securityPrice ?? this.totalPrice
    return price.dividedBy(portfolioPrice)
  }

  public clone(): PortfolioSecurity {
    const {
      price, currency, source, quotedAt,
    } = this.quote.toValues()
    return new PortfolioSecurity({
      tick: this.tick,
      isin: this.isin,
      price,
      exchange: this.exchange,
      currency,
      priceSource: source,
      pricedAt: quotedAt,
      shares: this.shares,
      initialShares: this.initialShares,
      targetPercentage: this.targetPercentageValue,
      brokerageFeeFlat: this.brokerageFeeFlatValue,
      tradingFeePercentage: this.tradingFeePercentageValue,
      minimumTradingFeeFlat: this.minimumTradingFeeFlatValue,
    })
  }
}
