import { IsNotEmpty, Min } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '@/Shared/ClassValidatorError'

export interface ISecurety {
  tick: string
  isin?: string
  price: number
  exchange?: string
  currency?: string
}

export class Security {
  @IsNotEmpty()
  public tick: string

  public isin?: string

  public price: Decimal

  @Min(0)
  protected get priceValue(): number {
    return this.price.toNumber()
  }

  public exchange?: string

  public currency?: string

  constructor({
    tick, isin, price, exchange, currency,
  }: ISecurety) {
    this.tick = tick
    this.isin = isin
    this.price = new Decimal(price)
    this.exchange = exchange
    this.currency = currency

    validateClassErrors(this, Security)
  }
}
