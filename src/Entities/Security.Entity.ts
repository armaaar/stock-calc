import { IsNotEmpty } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PriceQuote } from './PriceQuote.ValueObject'

export interface ISecurety {
  tick: string
  isin?: string
  price: number
  exchange?: string
  currency?: string
  /** Where the price came from, such as `justetf.com` or `override`. */
  priceSource?: string
  /** When the price was quoted. */
  pricedAt?: Date
}

/** A tradable instrument (its identity) and its price quote at plan time. */
export class Security {
  @IsNotEmpty()
  public readonly tick: string

  public readonly isin?: string

  public readonly exchange?: string

  /** The price quote. It validates itself, so a bad price fails before the identity is checked. */
  public readonly quote: PriceQuote

  constructor({
    tick, isin, price, exchange, currency, priceSource, pricedAt,
  }: ISecurety) {
    this.tick = tick
    this.isin = isin
    this.quote = new PriceQuote({
      price, currency, source: priceSource, quotedAt: pricedAt,
    })
    this.exchange = exchange

    validateClassErrors(this, Security)
  }

  public get price(): Decimal {
    return this.quote.price
  }

  public get currency(): string | undefined {
    return this.quote.currency
  }
}
