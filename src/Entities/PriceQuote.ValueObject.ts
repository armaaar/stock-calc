import {
  IsDate, IsNotEmpty, IsOptional, Min,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'

export interface IPriceQuote {
  price: number
  currency?: string
  /** Where the price came from, such as `justetf.com` or `override`. */
  source?: string
  /** When the price was quoted. */
  quotedAt?: Date
}

/**
 * The price of one share at plan time and where it came from. A value object: it has no
 * identity and never changes.
 */
export class PriceQuote {
  public readonly price: Decimal

  @Min(0)
  protected get priceValue(): number {
    return this.price.toNumber()
  }

  public readonly currency?: string

  @IsOptional()
  @IsNotEmpty()
  public readonly source?: string

  @IsOptional()
  @IsDate()
  public readonly quotedAt?: Date

  constructor({
    price, currency, source, quotedAt,
  }: IPriceQuote) {
    this.price = new Decimal(price)
    this.currency = currency
    this.source = source
    this.quotedAt = quotedAt

    validateClassErrors(this, PriceQuote)
  }

  /** The plain values this quote was built from, to build an equal one. */
  public toValues(): IPriceQuote {
    return {
      price: this.priceValue,
      currency: this.currency,
      source: this.source,
      quotedAt: this.quotedAt,
    }
  }
}
