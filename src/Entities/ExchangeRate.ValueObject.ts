import {
  IsISO8601, IsNotEmpty, IsOptional, IsPositive,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'

export interface IExchangeRate {
  /** The currency converted from: where the security is listed. */
  from: string
  /** The currency converted to: the portfolio's. */
  to: string
  /** How much of `to` one unit of `from` is worth. */
  rate: number
  /** Where the rate came from, such as `tradingview.com` or `override`. */
  source?: string
  /** When the rate was quoted, in ISO 8601: a UTC timestamp, or a date for an override. */
  quotedAt?: string
}

/**
 * The rate that converts a price listed in one currency into the portfolio's, and where it came
 * from. A value object: it has no identity and never changes.
 */
export class ExchangeRate {
  @IsNotEmpty()
  public readonly from: string

  @IsNotEmpty()
  public readonly to: string

  public readonly rate: Decimal

  @IsPositive()
  protected get rateValue(): number {
    return this.rate.toNumber()
  }

  @IsOptional()
  @IsNotEmpty()
  public readonly source?: string

  @IsOptional()
  @IsISO8601({ strict: true })
  public readonly quotedAt?: string

  constructor({
    from, to, rate, source, quotedAt,
  }: IExchangeRate) {
    this.from = from
    this.to = to
    this.rate = new Decimal(rate)
    this.source = source
    this.quotedAt = quotedAt

    validateClassErrors(this, ExchangeRate)
  }

  /** An amount in `from`, in `to`. */
  public convert(amount: Decimal): Decimal {
    return amount.times(this.rate)
  }

  /** The plain values this rate was built from, to build an equal one. */
  public toValues(): IExchangeRate {
    return {
      from: this.from,
      to: this.to,
      rate: this.rateValue,
      source: this.source,
      quotedAt: this.quotedAt,
    }
  }
}
