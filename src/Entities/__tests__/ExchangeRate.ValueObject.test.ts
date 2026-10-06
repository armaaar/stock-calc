import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { USD_EUR } from '#src/__fixtures__/portfolio'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import { ExchangeRate, IExchangeRate } from '../ExchangeRate.ValueObject'

const build = (overrides: Partial<IExchangeRate> = {}) => (
  new ExchangeRate({ ...USD_EUR, ...overrides })
)

/** The properties a construction fails validation on. */
function invalidProperties(fn: () => unknown): string[] {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(ClassValidatorError)
    return (e as ClassValidatorError).errors.map((error) => error.property)
  }
  throw Error('expected a validation error')
}

describe('ExchangeRate', () => {
  it('keeps the currencies, the rate as a Decimal, and where and when it was quoted', () => {
    const rate = build()

    expect(rate.from).toBe('USD')
    expect(rate.to).toBe('EUR')
    expect(rate.rate).toBeInstanceOf(Decimal)
    expect(rate.rate.toNumber()).toBe(0.9)
    expect(rate.source).toBe('tradingview.com')
    expect(rate.quotedAt).toBe('2026-10-06T09:30:00.000Z')
  })

  it('converts an amount from its currency into the other one, exactly', () => {
    expect(build({ rate: 0.8877 }).convert(new Decimal('41.2')).toString()).toBe('36.57324')
  })

  it('leaves where and when it was quoted out when unknown', () => {
    const rate = new ExchangeRate({ from: 'USD', to: 'EUR', rate: 1.1 })

    expect(rate.source).toBeUndefined()
    expect(rate.quotedAt).toBeUndefined()
  })

  it('accepts a date for a hand-entered rate', () => {
    expect(build({ source: 'override', quotedAt: '2026-10-01' }).quotedAt).toBe('2026-10-01')
  })

  it.each([0, -0.9])('rejects the rate %d', (rate) => {
    expect(invalidProperties(() => build({ rate }))).toEqual(['rateValue'])
  })

  it.each([
    ['from', { from: '' }],
    ['to', { to: '' }],
    ['source', { source: '' }],
    ['quotedAt', { quotedAt: 'yesterday' }],
  ])('rejects an invalid %s', (field, overrides) => {
    expect(invalidProperties(() => build(overrides))).toEqual([field])
  })

  it('gives back the values it was built from', () => {
    expect(build().toValues()).toEqual(USD_EUR)
    expect(new ExchangeRate(build().toValues())).toEqual(build())
  })
})
