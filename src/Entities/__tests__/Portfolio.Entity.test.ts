import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import { Portfolio } from '../Portfolio.Entity'
import { IPortfolioSecurity, PortfolioSecurity } from '../PortfolioSecurity.Entity'

function security(overrides: Partial<IPortfolioSecurity>): PortfolioSecurity {
  return new PortfolioSecurity({ ...QDVE, ...overrides })
}

function sharesOf(portfolio: Portfolio): Record<string, number> {
  return Object.fromEntries(portfolio.securities.map((sec) => [sec.tick, sec.shares]))
}

describe('Portfolio', () => {
  describe('construction', () => {
    it('holds the securities and takes the currency from them', () => {
      const portfolio = buildPortfolio()

      expect(portfolio.securities.map((sec) => sec.tick)).toEqual(['QDVE', 'SPYD'])
      expect(portfolio.currency).toBe('EUR')
    })

    it('accepts a single security at 100%', () => {
      const portfolio = new Portfolio({ securities: [security({ targetPercentage: 1 })] })

      expect(portfolio.securities).toHaveLength(1)
    })

    it.each([
      [[0.1, 0.2, 0.7]],
      [[0.7, 0.2, 0.1]],
    ])('accepts percentages %j summing to 1 with exact decimal arithmetic', (percentages) => {
      const securities = percentages.map(
        (targetPercentage, i) => security({ tick: `S${i}`, targetPercentage }),
      )

      expect(() => new Portfolio({ securities })).not.toThrow()
    })

    it('accepts percentages whose floating-point sum is not 1', () => {
      expect(0.7 + 0.2 + 0.1).not.toBe(1)

      expect(() => new Portfolio({
        securities: [
          security({ tick: 'A', targetPercentage: 0.7 }),
          security({ tick: 'B', targetPercentage: 0.2 }),
          security({ tick: 'C', targetPercentage: 0.1 }),
        ],
      })).not.toThrow()
    })

    it.each([
      [[0.5, 0.4], '0.9'],
      [[0.6, 0.6], '1.2'],
      [[0.5, 0.5000001], '1.0000001'],
    ])('rejects percentages %j that do not sum to exactly 1', (percentages, sum) => {
      const securities = percentages.map(
        (targetPercentage, i) => security({ tick: `S${i}`, targetPercentage }),
      )

      expect(() => new Portfolio({ securities }))
        .toThrow(`Portfolio percentage don't add up to 1 (${sum})`)
    })

    it('rejects securities with mixed currencies', () => {
      expect(() => buildPortfolio([QDVE, { ...SPYD, currency: 'USD' }]))
        .toThrow('Portfolio have securities with different currencies')
    })

    it('treats a missing currency as a currency of its own', () => {
      expect(() => buildPortfolio([QDVE, { ...SPYD, currency: undefined }]))
        .toThrow('Portfolio have securities with different currencies')
    })

    it('accepts securities that all lack a currency', () => {
      const portfolio = buildPortfolio([
        { ...QDVE, currency: undefined },
        { ...SPYD, currency: undefined },
      ])

      expect(portfolio.currency).toBeUndefined()
    })

    it('rejects an empty portfolio as a ClassValidatorError', () => {
      let error: unknown
      try {
        new Portfolio({ securities: [] })
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(ClassValidatorError)
      const { message, errors } = error as ClassValidatorError
      expect(message).toBe('Class \'Portfolio\' validation failed')
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('securities')
      expect(Object.keys(errors[0].constraints ?? {})).toEqual(['arrayNotEmpty'])
    })

    it('validates the securities before checking the percentage sum', () => {
      const qdve = security({ targetPercentage: 0.5 })
      qdve.shares = -1

      expect(() => new Portfolio({ securities: [qdve, new PortfolioSecurity(SPYD)] }))
        .toThrow(ClassValidatorError)
    })

    it('rejects a duplicate tick', () => {
      expect(() => buildPortfolio([
        { ...QDVE, targetPercentage: 0.2 },
        { ...QDVE, targetPercentage: 0.2 },
        SPYD,
      ])).toThrow('Portfolio has duplicate ticks (QDVE)')
    })

    it('names every duplicate tick once', () => {
      expect(() => buildPortfolio([
        { ...QDVE, targetPercentage: 0.2 },
        { ...SPYD, targetPercentage: 0.2 },
        { ...QDVE, targetPercentage: 0.2 },
        { ...SPYD, targetPercentage: 0.2 },
        { ...QDVE, targetPercentage: 0.2 },
      ])).toThrow('Portfolio has duplicate ticks (QDVE, SPYD)')
    })

    it('reports invalid nested securities as a ClassValidatorError', () => {
      const qdve = security({})
      const spyd = new PortfolioSecurity(SPYD)
      qdve.shares = -1

      let error: unknown
      try {
        new Portfolio({ securities: [qdve, spyd] })
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(ClassValidatorError)
      const { message, errors } = error as ClassValidatorError
      expect(message).toBe('Class \'Portfolio\' validation failed')
      expect(errors).toHaveLength(1)
      expect(errors[0].property).toBe('securities')
      expect(errors[0].children?.[0].property).toBe('0')
      expect(errors[0].children?.[0].children?.[0].property).toBe('shares')
    })

    it('skips validation when constructed as a subclass that does not validate itself', () => {
      class UnvalidatedPortfolio extends Portfolio {}
      const qdve = security({})
      qdve.shares = -1

      // By design (ADR-0004): only the most-derived constructor validates.
      expect(() => new UnvalidatedPortfolio({
        securities: [qdve, new PortfolioSecurity(SPYD)],
      })).not.toThrow()
    })
  })

  describe('totals', () => {
    it('values the current holdings of the example portfolio at 9055', () => {
      const portfolio = buildPortfolio()

      expect(portfolio.totalPrice.toNumber()).toBe(9055)
      expect(portfolio.initialTotalPrice.toNumber()).toBe(9055)
      expect(portfolio.totalTradedPrice.toNumber()).toBe(0)
      expect(portfolio.totalTradingFee.toNumber()).toBe(0)
    })

    it('sums proposed value, traded value and fees after a change', () => {
      const portfolio = buildPortfolio()
      portfolio.securities[0].shares = 127
      portfolio.securities[1].shares = 87

      expect(portfolio.totalPrice.toNumber()).toBe(9015.85)
      expect(portfolio.initialTotalPrice.toNumber()).toBe(9055)
      expect(portfolio.totalTradedPrice.toNumber()).toBe(-39.15)
      expect(portfolio.totalTradingFee.toNumber()).toBe(2)
    })

    it('only charges fees for securities that are traded', () => {
      const portfolio = buildPortfolio()
      portfolio.securities[1].shares = 50

      expect(portfolio.totalTradingFee.toNumber()).toBe(1)
    })
  })

  describe('balanceForPrice', () => {
    it('rebalances the example portfolio at its own value to QDVE 127 / SPYD 87', () => {
      const portfolio = buildPortfolio()

      portfolio.balanceForPrice(portfolio.totalPrice)

      expect(sharesOf(portfolio)).toEqual({ QDVE: 127, SPYD: 87 })
      expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([100, 100])
    })

    it('allocates a target value of 5000 to QDVE 70 / SPYD 48', () => {
      const portfolio = buildPortfolio()

      portfolio.balanceForPrice(new Decimal(5000))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 70, SPYD: 48 })
      expect(portfolio.totalPrice.toNumber()).toBe(4972.3)
    })

    it('rounds half up', () => {
      const portfolio = new Portfolio({
        securities: [security({ price: 10, targetPercentage: 1 })],
      })

      portfolio.balanceForPrice(new Decimal(25))
      expect(portfolio.securities[0].shares).toBe(3)

      portfolio.balanceForPrice(new Decimal(24.99))
      expect(portfolio.securities[0].shares).toBe(2)
    })

    it('accepts a price of 0 and proposes no shares', () => {
      const portfolio = buildPortfolio()

      portfolio.balanceForPrice(new Decimal(0))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 0, SPYD: 0 })
    })

    it.each([
      [-5000, '-5000'],
      [NaN, 'NaN'],
      [Infinity, 'Infinity'],
      [-Infinity, '-Infinity'],
    ])('rejects the price %d without changing any shares', (price, shown) => {
      const portfolio = buildPortfolio()

      expect(() => portfolio.balanceForPrice(new Decimal(price)))
        .toThrow(`Portfolio price must be a finite number of at least 0 (${shown})`)
      expect(sharesOf(portfolio)).toEqual({ QDVE: 100, SPYD: 100 })
    })
  })

  describe('clone', () => {
    it('produces an equal but independent deep copy', () => {
      const portfolio = buildPortfolio()
      portfolio.securities[0].shares = 127

      const copy = portfolio.clone()

      expect(copy).not.toBe(portfolio)
      expect(copy).toEqual(portfolio)
      expect(copy.securities[0]).not.toBe(portfolio.securities[0])
      expect(copy.securities[0].initialShares).toBe(100)

      copy.securities[0].shares = 1
      expect(portfolio.securities[0].shares).toBe(127)
    })

    it('re-validates through the constructors', () => {
      const portfolio = buildPortfolio()
      portfolio.securities[0].targetPercentage = new Decimal(0.5)

      expect(() => portfolio.clone()).toThrow('Portfolio percentage don\'t add up to 1 (1.1)')
    })
  })
})
