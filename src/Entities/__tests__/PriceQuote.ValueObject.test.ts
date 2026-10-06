import { describe, expect, it } from 'vitest'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import { PriceQuote } from '../PriceQuote.ValueObject'

function validationErrorOf(fn: () => unknown): ClassValidatorError {
  try {
    fn()
  } catch (e) {
    return e as ClassValidatorError
  }
  throw new Error('Expected a validation error')
}

describe('PriceQuote', () => {
  it('holds the price as a Decimal, with its currency, source and time', () => {
    const quotedAt = new Date('2026-10-06T12:00:00Z')
    const quote = new PriceQuote({
      price: 28.45, currency: 'EUR', source: 'justetf.com', quotedAt,
    })

    expect(quote.price.toNumber()).toBe(28.45)
    expect(quote.currency).toBe('EUR')
    expect(quote.source).toBe('justetf.com')
    expect(quote.quotedAt).toBe(quotedAt)
  })

  it('leaves the currency, source and time undefined when they are unknown', () => {
    const quote = new PriceQuote({ price: 1 })

    expect(quote.toValues()).toEqual({
      price: 1, currency: undefined, source: undefined, quotedAt: undefined,
    })
  })

  it('accepts a price of zero', () => {
    expect(new PriceQuote({ price: 0 }).price.isZero()).toBe(true)
  })

  it.each([
    ['a negative price', { price: -1 }, 'priceValue'],
    ['an empty source', { price: 1, source: '' }, 'source'],
    ['an invalid time', { price: 1, quotedAt: new Date('not a date') }, 'quotedAt'],
  ])('rejects %s', (_, values, property) => {
    const error = validationErrorOf(() => new PriceQuote(values))

    expect(error).toBeInstanceOf(ClassValidatorError)
    expect(error.message).toBe('Class \'PriceQuote\' validation failed')
    expect(error.errors.map((e) => e.property)).toEqual([property])
  })

  it('round-trips through toValues', () => {
    const quote = new PriceQuote({
      price: 62.1, currency: 'EUR', source: 'override', quotedAt: new Date('2026-10-01'),
    })

    expect(new PriceQuote(quote.toValues())).toEqual(quote)
  })
})
