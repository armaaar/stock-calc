import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { QDVE } from '#src/__fixtures__/portfolio'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import { IPortfolioSecurity, PortfolioSecurity } from '../PortfolioSecurity.Entity'

function build(overrides: Partial<IPortfolioSecurity> = {}): PortfolioSecurity {
  return new PortfolioSecurity({ ...QDVE, ...overrides })
}

function validationErrorOf(fn: () => unknown): ClassValidatorError {
  try {
    fn()
  } catch (e) {
    return e as ClassValidatorError
  }
  throw new Error('Expected a validation error')
}

describe('PortfolioSecurity', () => {
  describe('construction', () => {
    it('stores the security fields and converts numbers to Decimals', () => {
      const sec = build()

      expect(sec.tick).toBe('QDVE')
      expect(sec.isin).toBe('IE00B3WJKG14')
      expect(sec.exchange).toBe('IBIS2')
      expect(sec.currency).toBe('EUR')
      expect(sec.price.toNumber()).toBe(28.45)
      expect(sec.shares).toBe(100)
      expect(sec.targetPercentage).toBeInstanceOf(Decimal)
      expect(sec.targetPercentage.toNumber()).toBe(0.4)
      expect(sec.brokerageFeeFlat.toNumber()).toBe(1)
      expect(sec.tradingFeePercentage.toNumber()).toBe(0)
      expect(sec.minimumTradingFeeFlat.toNumber()).toBe(0)
    })

    it('defaults initialShares to shares', () => {
      expect(build({ shares: 42 }).initialShares).toBe(42)
    })

    it('keeps an explicit initialShares', () => {
      const sec = build({ shares: 42, initialShares: 7 })

      expect(sec.shares).toBe(42)
      expect(sec.initialShares).toBe(7)
    })

    it('defaults all fees to zero', () => {
      const sec = new PortfolioSecurity({
        tick: 'QDVE', price: 10, shares: 1, targetPercentage: 1,
      })

      expect(sec.brokerageFeeFlat.isZero()).toBe(true)
      expect(sec.tradingFeePercentage.isZero()).toBe(true)
      expect(sec.minimumTradingFeeFlat.isZero()).toBe(true)
    })

    it('accepts the boundary values 0 and 1', () => {
      expect(() => build({
        shares: 0, targetPercentage: 0, tradingFeePercentage: 1,
        brokerageFeeFlat: 0, minimumTradingFeeFlat: 0,
      })).not.toThrow()
      expect(() => build({ targetPercentage: 1, tradingFeePercentage: 0 })).not.toThrow()
    })
  })

  describe('validation', () => {
    it.each([
      ['negative shares', { shares: -1, initialShares: 100 }, 'shares'],
      ['fractional shares', { shares: 1.5, initialShares: 100 }, 'shares'],
      ['negative initialShares', { initialShares: -1 }, 'initialShares'],
      ['fractional initialShares', { initialShares: 0.5 }, 'initialShares'],
      ['targetPercentage above 1', { targetPercentage: 1.01 }, 'targetPercentageValue'],
      ['negative targetPercentage', { targetPercentage: -0.1 }, 'targetPercentageValue'],
      ['negative brokerageFeeFlat', { brokerageFeeFlat: -1 }, 'brokerageFeeFlatValue'],
      ['tradingFeePercentage above 1', { tradingFeePercentage: 2 }, 'tradingFeePercentageValue'],
      [
        'negative tradingFeePercentage',
        { tradingFeePercentage: -0.01 },
        'tradingFeePercentageValue',
      ],
      ['negative minimumTradingFeeFlat', { minimumTradingFeeFlat: -5 }, 'minimumTradingFeeFlatValue'],
    ] as [string, Partial<IPortfolioSecurity>, string][])(
      'rejects %s',
      (_, overrides, property) => {
        const error = validationErrorOf(() => build(overrides))

        expect(error).toBeInstanceOf(ClassValidatorError)
        expect(error.message).toBe('Class \'PortfolioSecurity\' validation failed')
        expect(error.errors.map((e) => e.property)).toEqual([property])
      },
    )

    it('reports an invalid shares count once when initialShares defaults to it', () => {
      const error = validationErrorOf(() => build({ shares: -1 }))

      expect(error.errors.map((e) => e.property)).toEqual(['shares'])
    })

    it('reports an invalid shares count once when initialShares is explicitly equal', () => {
      const error = validationErrorOf(() => build({ shares: 1.5, initialShares: 1.5 }))

      expect(error.errors.map((e) => e.property)).toEqual(['shares'])
    })

    it('reports shares and initialShares separately when both differ and are invalid', () => {
      const error = validationErrorOf(() => build({ shares: -1, initialShares: 0.5 }))

      expect(error.errors.map((e) => e.property)).toEqual(['shares', 'initialShares'])
    })

    it('validates the inherited Security constraints once, as PortfolioSecurity', () => {
      const error = validationErrorOf(() => build({ tick: '', price: -1 }))

      expect(error.message).toBe('Class \'PortfolioSecurity\' validation failed')
      expect(error.errors.map((e) => e.property).sort()).toEqual(['priceValue', 'tick'])
    })
  })

  describe('prices', () => {
    it('computes total, initial total and traded price', () => {
      const sec = build({ shares: 127, initialShares: 100 })

      expect(sec.totalPrice.toNumber()).toBe(3613.15)
      expect(sec.initialTotalPrice.toNumber()).toBe(2845)
      expect(sec.tradedPrice.toNumber()).toBe(768.15)
    })

    it('has a negative traded price for sells', () => {
      const sec = build({ shares: 70, initialShares: 100 })

      expect(sec.tradedPrice.toNumber()).toBe(-853.5)
    })

    it('reports whether it is being traded', () => {
      const sec = build()
      expect(sec.isBeingTraded).toBe(false)

      sec.shares = 101
      expect(sec.isBeingTraded).toBe(true)
    })
  })

  describe('shares', () => {
    it('accepts a new whole number of shares, including 0', () => {
      const sec = build()

      sec.shares = 0
      expect(sec.shares).toBe(0)
      sec.shares = 250
      expect(sec.shares).toBe(250)
      expect(sec.initialShares).toBe(100)
    })

    it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects %s, naming the security, and keeps the previous value',
      (shares) => {
        const sec = build({ shares: 127, initialShares: 100 })

        expect(() => {
          sec.shares = shares
        }).toThrow(`Shares of 'QDVE' must be a whole number of at least 0 (${shares})`)
        expect(sec.shares).toBe(127)
      },
    )

    it('reports bad constructor shares as a validation error, not the setter message', () => {
      const error = validationErrorOf(() => build({ shares: -1, initialShares: 0 }))

      expect(error).toBeInstanceOf(ClassValidatorError)
      expect(error.errors.map((e) => e.property)).toEqual(['shares'])
    })
  })

  describe('tradingFee', () => {
    const fees = { brokerageFeeFlat: 2, tradingFeePercentage: 0.002, minimumTradingFeeFlat: 10 }

    it('is zero when not traded, even with a flat fee', () => {
      expect(build(fees).tradingFee.isZero()).toBe(true)
    })

    it('charges flat + minimum when the percentage fee is below the minimum', () => {
      // buying 1,000: 2 + max(2, 10) = 12
      const sec = build({ ...fees, price: 100, initialShares: 0, shares: 10 })

      expect(sec.tradingFee.toNumber()).toBe(12)
    })

    it('charges flat + percentage when the percentage fee is above the minimum', () => {
      // buying 10,000: 2 + max(20, 10) = 22
      const sec = build({ ...fees, price: 100, initialShares: 0, shares: 100 })

      expect(sec.tradingFee.toNumber()).toBe(22)
    })

    it('charges the minimum when the percentage fee equals it', () => {
      // buying 5,000: 2 + max(10, 10) = 12
      const sec = build({ ...fees, price: 100, initialShares: 0, shares: 50 })

      expect(sec.tradingFee.toNumber()).toBe(12)
    })

    it('charges the percentage on the value of a sell, like a buy', () => {
      // selling 100,000: 2 + max(200, 10) = 202
      const sec = build({ ...fees, price: 100, initialShares: 1000, shares: 0 })

      expect(sec.tradedPrice.toNumber()).toBe(-100000)
      expect(sec.tradingFee.toNumber()).toBe(202)
    })

    it('charges the same fee to a buy and a sell of the same value', () => {
      const buy = build({ ...fees, price: 100, initialShares: 0, shares: 70 })
      const sell = build({ ...fees, price: 100, initialShares: 70, shares: 0 })

      expect(sell.tradingFee.toNumber()).toBe(buy.tradingFee.toNumber())
    })

    it('charges flat + minimum on a small sell', () => {
      // selling 1,000: 2 + max(2, 10) = 12
      const sec = build({ ...fees, price: 100, initialShares: 10, shares: 0 })

      expect(sec.tradingFee.toNumber()).toBe(12)
    })

    it('charges flat + percentage on sells when there is no minimum', () => {
      // selling 1,000: 1 + 1% of 1,000 = 11
      const sec = build({
        brokerageFeeFlat: 1, tradingFeePercentage: 0.01, minimumTradingFeeFlat: 0,
        price: 100, initialShares: 10, shares: 0,
      })

      expect(sec.tradingFee.toNumber()).toBe(11)
    })

    it('charges the flat fee per order with the example settings', () => {
      expect(build({ shares: 127, initialShares: 100 }).tradingFee.toNumber()).toBe(1)
    })
  })

  describe('calcActualPercentage', () => {
    it('divides the proposed total price by the portfolio price by default', () => {
      const sec = build()

      expect(sec.calcActualPercentage(new Decimal(9055)).toNumber())
        .toBeCloseTo(0.31419, 5)
    })

    it('uses the given security price when provided', () => {
      const sec = build()

      expect(sec.calcActualPercentage(new Decimal(200), new Decimal(50)).toNumber()).toBe(0.25)
    })

    it('returns 0 instead of NaN when both prices are 0', () => {
      const sec = build({ shares: 0 })

      expect(sec.calcActualPercentage(new Decimal(0)).toNumber()).toBe(0)
    })

    it('returns 0 instead of Infinity when only the portfolio price is 0', () => {
      const sec = build()

      expect(sec.calcActualPercentage(new Decimal(0)).toNumber()).toBe(0)
    })

    it('returns 0 for a given nonzero security price over a zero portfolio price', () => {
      const sec = build()

      expect(sec.calcActualPercentage(new Decimal(0), new Decimal(-50)).toNumber()).toBe(0)
    })
  })

  describe('clone', () => {
    it('produces an equal but independent copy', () => {
      const sec = build({
        shares: 127, initialShares: 100,
        tradingFeePercentage: 0.002, minimumTradingFeeFlat: 10,
      })
      const copy = sec.clone()

      expect(copy).not.toBe(sec)
      expect(copy).toBeInstanceOf(PortfolioSecurity)
      expect(copy).toEqual(sec)
      expect(copy.price).not.toBe(sec.price)

      copy.shares = 1
      expect(sec.shares).toBe(127)
    })

    it('re-validates through the constructor', () => {
      const sec = build()
      Object.assign(sec, { minimumTradingFeeFlat: new Decimal(-1) })

      expect(() => sec.clone()).toThrow(ClassValidatorError)
    })
  })
})
