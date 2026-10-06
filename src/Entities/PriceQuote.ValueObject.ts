import {
  IsISO8601, IsNotEmpty, IsOptional, Min,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'

export interface IPriceQuote {
  price: number
  currency?: string
  /** Where the price came from, such as `justetf.com` or `override`. */
  source?: string
  /**
   * When the price was quoted, in ISO 8601: a UTC timestamp for a live quote, or just a date
   * (`2026-10-01`) for an override, whose time of day isn't known.
   */
  quotedAt?: string
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
  @IsISO8601({ strict: true })
  public readonly quotedAt?: string

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
