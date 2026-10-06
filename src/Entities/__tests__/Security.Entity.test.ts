import { describe, expect, it } from 'vitest'
import { ClassValidatorError } from '@/Shared/ClassValidatorError'
import { Security } from '../Security.Entity'

describe('Security', () => {
  it('stores identity and converts the price to a Decimal', () => {
    const security = new Security({
      tick: 'QDVE', isin: 'IE00B3WJKG14', price: 28.45, exchange: 'IBIS2', currency: 'EUR',
    })

    expect(security.tick).toBe('QDVE')
    expect(security.isin).toBe('IE00B3WJKG14')
    expect(security.exchange).toBe('IBIS2')
    expect(security.currency).toBe('EUR')
    expect(security.price.toNumber()).toBe(28.45)
  })

  it('leaves optional identity fields undefined when omitted', () => {
    const security = new Security({ tick: 'QDVE', price: 1 })

    expect(security.isin).toBeUndefined()
    expect(security.exchange).toBeUndefined()
    expect(security.currency).toBeUndefined()
  })

  it('accepts a price of zero', () => {
    expect(new Security({ tick: 'QDVE', price: 0 }).price.isZero()).toBe(true)
  })

  it('rejects an empty tick', () => {
    expect(() => new Security({ tick: '', price: 1 })).toThrow(ClassValidatorError)
  })

  it('rejects a negative price', () => {
    expect(() => new Security({ tick: 'QDVE', price: -1 })).toThrow(ClassValidatorError)
  })

  it('reports every failing constraint in one error', () => {
    let error: unknown
    try {
      new Security({ tick: '', price: -1 })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ClassValidatorError)
    const { message, errors } = error as ClassValidatorError
    expect(message).toBe('Class \'Security\' validation failed')
    expect(errors.map((e) => e.property).sort()).toEqual(['priceValue', 'tick'])
  })

  it('skips validation when constructed as a subclass that does not validate itself', () => {
    class UnvalidatedSecurity extends Security {}

    // By design (ADR-0004): validateClassErrors only runs when the object's constructor is
    // exactly the given class, so a subclass that doesn't validate itself is never validated.
    expect(() => new UnvalidatedSecurity({ tick: '', price: -1 })).not.toThrow()
  })
})
