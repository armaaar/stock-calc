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

    it('keeps its own frozen list of securities, unaffected by the array it was built from', () => {
      const securities = [new PortfolioSecurity(QDVE), new PortfolioSecurity(SPYD)]
      const portfolio = new Portfolio({ securities })

      securities.push(new PortfolioSecurity({ ...QDVE, targetPercentage: 0.5 }))

      expect(portfolio.securities.map((sec) => sec.tick)).toEqual(['QDVE', 'SPYD'])
      expect(Object.isFrozen(portfolio.securities)).toBe(true)
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

    it('rejects securities with mixed currencies, naming each one\'s currency and the fix', () => {
      expect(() => buildPortfolio([QDVE, { ...SPYD, currency: 'USD' }])).toThrow(
        'Portfolio has securities in different currencies (QDVE: EUR, SPYD: USD). '
        + 'Price them all in one currency, for example with a price override',
      )
    })

    it('treats a missing currency as a currency of its own', () => {
      expect(() => buildPortfolio([QDVE, { ...SPYD, currency: undefined }]))
        .toThrow('Portfolio has securities in different currencies (QDVE: EUR, SPYD: unknown)')
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
      Object.assign(qdve, { minimumTradingFeeFlat: new Decimal(-1) })

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
      Object.assign(qdve, { minimumTradingFeeFlat: new Decimal(-1) })

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
      expect(errors[0].children?.[0].children?.[0].property).toBe('minimumTradingFeeFlatValue')
    })

    it('skips validation when constructed as a subclass that does not validate itself', () => {
      class UnvalidatedPortfolio extends Portfolio {}
      const qdve = security({})
      Object.assign(qdve, { minimumTradingFeeFlat: new Decimal(-1) })

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

  describe('cash', () => {
    it('holds no cash and plans no deposit by default', () => {
      const portfolio = buildPortfolio()

      expect(portfolio.cash.toNumber()).toBe(0)
      expect(portfolio.deposit.toNumber()).toBe(0)
      expect(portfolio.cashAfterTrades.toNumber()).toBe(0)
    })

    it('keeps the cash it holds', () => {
      expect(buildPortfolio(undefined, 250.5).cash.toNumber()).toBe(250.5)
    })

    it.each([-0.01, NaN, Infinity])('rejects %d cash as a ClassValidatorError', (cash) => {
      let error: unknown
      try {
        buildPortfolio(undefined, cash)
      } catch (e) {
        error = e
      }

      expect(error).toBeInstanceOf(ClassValidatorError)
      expect((error as ClassValidatorError).errors.map((e) => e.property)).toEqual(['cashValue'])
    })

    it('counts cash held + deposit - net traded - fees as the cash after trades', () => {
      const portfolio = buildPortfolio(undefined, 100)
      portfolio.securities[0].shares = 110 // buy 10 QDVE: 284.5, fee 1

      expect(portfolio.cashAfterTrades.toNumber()).toBe(100 - 284.5 - 1)
    })
  })

  describe('expensiveOrders', () => {
    it('warns above 1% of the order value by default', () => {
      const portfolio = buildPortfolio([
        { ...QDVE, brokerageFeeFlat: 3 },
        { ...SPYD, brokerageFeeFlat: 3 },
      ])
      expect(portfolio.feeWarningPercentage.toNumber()).toBe(0.01)

      portfolio.securities[0].shares = 110 // 3 / 284.5 = 1.05%
      portfolio.securities[1].shares = 95 // 3 / 310.5 = 0.97%

      expect(portfolio.expensiveOrders.map((sec) => sec.tick)).toEqual(['QDVE'])
    })

    it('uses the portfolio\'s own warning percentage, exclusive', () => {
      const portfolio = new Portfolio({
        securities: [
          new PortfolioSecurity({ ...QDVE, brokerageFeeFlat: 3, price: 30, targetPercentage: 1 }),
        ],
        feeWarningPercentage: 0.01,
      })
      portfolio.securities[0].shares = 110 // 3 / 300 = exactly 1%

      expect(portfolio.expensiveOrders).toEqual([])
    })

    it('is empty without trades', () => {
      expect(buildPortfolio().expensiveOrders).toEqual([])
    })

    it.each([-0.01, 1.01, NaN])('rejects a warning percentage of %d', (feeWarningPercentage) => {
      expect(() => new Portfolio({
        securities: [new PortfolioSecurity({ ...QDVE, targetPercentage: 1 })],
        feeWarningPercentage,
      })).toThrow(ClassValidatorError)
    })
  })

  describe('allocateCash', () => {
    const two = (a: Partial<IPortfolioSecurity>, b: Partial<IPortfolioSecurity>) => (
      new Portfolio({
        securities: [
          security({ tick: 'A', brokerageFeeFlat: 1, ...a }),
          security({ tick: 'B', brokerageFeeFlat: 1, ...b }),
        ],
      })
    )

    it('rebalances the example portfolio with no deposit to QDVE 127 / SPYD 87', () => {
      const portfolio = buildPortfolio()

      portfolio.allocateCash(new Decimal(0))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 127, SPYD: 87 })
      expect(portfolio.cashAfterTrades.toNumber()).toBe(37.15)
    })

    it('invests 1000 in the example portfolio as QDVE 141 / SPYD 97, leaving 17.85', () => {
      const portfolio = buildPortfolio()

      portfolio.allocateCash(new Decimal(1000))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 141, SPYD: 97 })
      expect(portfolio.deposit.toNumber()).toBe(1000)
      expect(portfolio.cashAfterTrades.toNumber()).toBe(17.85)
    })

    it('invests the cash held as well as the deposit', () => {
      const portfolio = buildPortfolio(undefined, 500)

      portfolio.allocateCash(new Decimal(0))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 134, SPYD: 92 })
      expect(portfolio.totalTradedPrice.toNumber()).toBe(470.5)
      expect(portfolio.cashAfterTrades.toNumber()).toBe(27.5)
    })

    it('sells a little more when rounding and fees would need more than the deposit', () => {
      // Rounding alone gives QDVE 127 / SPYD 88: 24.95 needed for a deposit of 2. Selling one
      // more SPYD covers it and lands closer to target than cancelling a QDVE buy would.
      const naive = buildPortfolio()
      naive.balanceForPrice(naive.initialTotalPrice.plus(2))
      expect(naive.totalTradedPrice.plus(naive.totalTradingFee).toNumber()).toBe(24.95)

      const portfolio = buildPortfolio()
      portfolio.allocateCash(new Decimal(2))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 127, SPYD: 87 })
      expect(portfolio.cashAfterTrades.toNumber()).toBe(39.15)
    })

    it('cancels a buy when that lands closer to target than selling more', () => {
      // Investing 25: rounding gives QDVE 128 / SPYD 88, 28.40 short after fees
      const portfolio = buildPortfolio()

      portfolio.allocateCash(new Decimal(25))

      // One QDVE fewer (127 / 88) is closer to target than selling one more SPYD (128 / 87)
      expect(sharesOf(portfolio)).toEqual({ QDVE: 127, SPYD: 88 })
      expect(portfolio.cashAfterTrades.toNumber()).toBe(0.05)
    })

    it('never needs more cash than it was given, for any deposit', () => {
      for (let deposit = 0; deposit <= 300; deposit += 1) {
        const portfolio = buildPortfolio()
        portfolio.allocateCash(new Decimal(deposit))
        expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
      }
    })

    it('sells more when cancelling buys is not enough to cover a withdrawal and its fees', () => {
      // 10 x 10 held, flat fee 5. Withdrawing 50 by selling 5 raises only 45 after the fee.
      const portfolio = new Portfolio({
        securities: [security({ price: 10, shares: 10, targetPercentage: 1, brokerageFeeFlat: 5 })],
      })

      portfolio.allocateCash(new Decimal(-50))

      expect(portfolio.securities[0].shares).toBe(4)
      expect(portfolio.cashAfterTrades.toNumber()).toBe(5)
    })

    it('sells everything and reports the shortfall when even that is not enough', () => {
      const portfolio = buildPortfolio()

      portfolio.allocateCash(new Decimal(-9055))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 0, SPYD: 0 })
      // Selling everything raises 9055 but costs 2 in fees
      expect(portfolio.cashAfterTrades.toNumber()).toBe(-2)
    })

    it('rejects a withdrawal larger than the holdings and the cash held together', () => {
      const portfolio = buildPortfolio(undefined, 45)

      expect(() => portfolio.allocateCash(new Decimal(-9100.01)))
        .toThrow('Cannot withdraw 9100.01: more than the portfolio value (9100)')
      expect(sharesOf(portfolio)).toEqual({ QDVE: 100, SPYD: 100 })
      expect(portfolio.deposit.toNumber()).toBe(0)
    })

    describe('when cancelling buys leaves only sells', () => {
      it('trades nothing rather than sell everything to pay a minimum fee', () => {
        // Balancing buys 8 A and sells 7 B; fees of 1 + minimum 10 per order make both cost more
        // than they move. Trading nothing is free.
        const portfolio = two(
          { price: 1, shares: 0, targetPercentage: 0.75, minimumTradingFeeFlat: 10 },
          { price: 1, shares: 10, targetPercentage: 0.25, minimumTradingFeeFlat: 10 },
        )

        portfolio.allocateCash(new Decimal(0))

        expect(sharesOf(portfolio)).toEqual({ A: 0, B: 10 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(0)
      })

      it('sells more to pay for a buy when that lands closer to target than trading nothing', () => {
        // Balancing buys 1 A (50 + 1 fee) with 60 B (30 - 1 fee): 22 short. Selling 44 more B
        // pays for it, and 50 / 8 is closer to 50/50 than holding only B.
        const portfolio = two(
          { price: 50, shares: 0, targetPercentage: 0.5 },
          { price: 0.5, shares: 120, targetPercentage: 0.5 },
        )

        portfolio.allocateCash(new Decimal(0))

        expect(sharesOf(portfolio)).toEqual({ A: 1, B: 16 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(0)
      })

      it('rebalances with a little more selling rather than skip a buy over a fee', () => {
        // 4 A / 7 B at 45/55: balancing buys 1 A and sells 1 B, 2 short in fees. Selling a
        // second B pays for it: 5 / 5 is closer to target than 4 / 7.
        const portfolio = two(
          { price: 28.45, shares: 4, targetPercentage: 0.45 },
          { price: 28.45, shares: 7, targetPercentage: 0.55 },
        )

        portfolio.allocateCash(new Decimal(0))

        expect(sharesOf(portfolio)).toEqual({ A: 5, B: 5 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(26.45)
      })

      it('trades nothing rather than sell a share for less than its fee', () => {
        const portfolio = two(
          { price: 0.37, shares: 1, targetPercentage: 0.34 },
          { price: 62.1, shares: 0, targetPercentage: 0.66 },
        )

        portfolio.allocateCash(new Decimal(0))

        expect(sharesOf(portfolio)).toEqual({ A: 1, B: 0 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(0)
      })
    })

    describe('withdrawing', () => {
      it('drops a sell whose fee is more than it raises, and sells more of another', () => {
        // Withdrawing 100: balancing sells 1 A (0.50, fee 1) and 1 B (100, fee 1), raising
        // only 98.50. B sells one more share, and the A sale, which only loses money, is dropped.
        const portfolio = new Portfolio({
          securities: [
            security({
              tick: 'A', price: 0.5, shares: 3, targetPercentage: 0.001, brokerageFeeFlat: 1,
            }),
            security({
              tick: 'B', price: 100, shares: 10, targetPercentage: 0.999, brokerageFeeFlat: 1,
            }),
          ],
        })

        portfolio.allocateCash(new Decimal(-100))

        expect(sharesOf(portfolio)).toEqual({ A: 3, B: 8 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(99)
      })

      it('sells the fewest shares that cover the withdrawal and the order\'s fee', () => {
        // Withdrawing 3 from 10 x 1 with a flat fee of 5: selling 3 raises 3 for a fee of 5.
        // Selling 8 raises exactly 3 after the fee.
        const portfolio = new Portfolio({
          securities: [
            security({ price: 1, shares: 10, targetPercentage: 1, brokerageFeeFlat: 5 }),
          ],
        })

        portfolio.allocateCash(new Decimal(-3))

        expect(portfolio.securities[0].shares).toBe(2)
        expect(portfolio.cashAfterTrades.toNumber()).toBe(0)
      })

      it('sells a small withdrawal from an expensive holding without selling all of it', () => {
        const portfolio = new Portfolio({
          securities: [
            security({ price: 1, shares: 10000, targetPercentage: 1, brokerageFeeFlat: 5 }),
          ],
        })

        portfolio.allocateCash(new Decimal(-3))

        expect(portfolio.securities[0].shares).toBe(9992)
        expect(portfolio.cashAfterTrades.toNumber()).toBe(0)
      })

      it('sells whole holdings one by one when none covers the withdrawal alone', () => {
        // Withdrawing 12 from 10 x 1 A and 10 x 1 B, flat fee 5 each: everything raises 10
        const portfolio = two(
          { price: 1, shares: 10, targetPercentage: 0.5, brokerageFeeFlat: 5 },
          { price: 1, shares: 10, targetPercentage: 0.5, brokerageFeeFlat: 5 },
        )

        portfolio.allocateCash(new Decimal(-12))

        expect(sharesOf(portfolio)).toEqual({ A: 0, B: 0 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(-2)
      })

      it('sells from a holding that rounding left untouched, when nothing else is sold', () => {
        // Withdrawing 40 from 10 x 100 A and 10 x 101 B: balancing keeps 10 / 10 (both round
        // up), so it plans no sale at all. One share of either covers 40 and its fee; selling
        // B, the heavier holding, lands closer to 50/50.
        const portfolio = two(
          { price: 100, shares: 10, targetPercentage: 0.5 },
          { price: 101, shares: 10, targetPercentage: 0.5 },
        )

        portfolio.allocateCash(new Decimal(-40))

        expect(sharesOf(portfolio)).toEqual({ A: 10, B: 9 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(60)
      })

      it('sells the first holding when two cover a withdrawal equally well', () => {
        const portfolio = two(
          { price: 100, shares: 10, targetPercentage: 0.5 },
          { price: 100, shares: 10, targetPercentage: 0.5 },
        )

        portfolio.allocateCash(new Decimal(-40))

        expect(sharesOf(portfolio)).toEqual({ A: 9, B: 10 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(59)
      })

      it('sells the holding that raises most first when none covers the withdrawal alone', () => {
        // Withdrawing 24 from 10 x 1 A and 10 x 2 B, flat fee 5 each: everything raises 20
        const portfolio = two(
          { price: 1, shares: 10, targetPercentage: 0.5, brokerageFeeFlat: 5 },
          { price: 2, shares: 10, targetPercentage: 0.5, brokerageFeeFlat: 5 },
        )

        portfolio.allocateCash(new Decimal(-24))

        expect(sharesOf(portfolio)).toEqual({ A: 0, B: 0 })
        expect(portfolio.cashAfterTrades.toNumber()).toBe(-4)
      })

      it('keeps only the sells a withdrawal needs when a buy it funded is cancelled', () => {
        // Withdrawing 10: balancing buys 1 A (250) and sells 255 B. Selling 7 more B covers
        // the shortfall and stays closer to target than cancelling the A buy.
        const portfolio = two(
          { price: 250, shares: 0, targetPercentage: 0.5 },
          { price: 1, shares: 500, targetPercentage: 0.5 },
        )

        portfolio.allocateCash(new Decimal(-10))

        expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
        expect(portfolio.cashAfterTrades.lessThan(1)).toBe(true)
        expect(sharesOf(portfolio).A).toBe(1)
      })
    })

    it('needs no new money whenever trading nothing is affordable (random portfolios)', () => {
      // A small deterministic generator, so a failure is reproducible
      let seed = 42
      const random = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648
        return seed / 2147483648
      }
      const pick = <T>(values: T[]) => values[Math.floor(random() * values.length)]

      for (let run = 0; run < 400; run++) {
        // Targets in twentieths, so they add up to exactly 1
        const count = 1 + Math.floor(random() * 3)
        const units = Array.from({ length: count }, () => 1)
        for (let unit = count; unit < 20; unit++) units[Math.floor(random() * count)] += 1
        const portfolio = new Portfolio({
          securities: units.map((unit, i) => security({
            tick: `S${i}`,
            price: pick([0.37, 1, 5, 28.45, 62.1, 250]),
            shares: Math.floor(random() * 40),
            targetPercentage: unit / 20,
            brokerageFeeFlat: pick([0, 1, 3]),
            tradingFeePercentage: pick([0, 0.001, 0.01]),
            minimumTradingFeeFlat: pick([0, 2, 10]),
          })),
          cash: pick([0, 0, 15, 400]),
        })
        const deposit = pick([0, 0, 1, 20, 100, 1000])

        portfolio.allocateCash(new Decimal(deposit))

        expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
        const sells = portfolio.securities.some((sec) => sec.shares < sec.initialShares)
        const buys = portfolio.securities.some((sec) => sec.shares > sec.initialShares)
        expect(sells && !buys).toBe(false)
      }
    })

    it('stays fast when fees leave it far short', () => {
      // A 1% fee on 10 million at 0.37 a share: trimming one share at a time would take
      // hundreds of thousands of steps
      const portfolio = new Portfolio({
        securities: [
          security({ tick: 'A', price: 0.37, shares: 0, targetPercentage: 0.5, tradingFeePercentage: 0.01 }),
          security({ tick: 'B', price: 0.37, shares: 0, targetPercentage: 0.5, tradingFeePercentage: 0.01 }),
        ],
      })

      const started = performance.now()
      portfolio.allocateCash(new Decimal(10_000_000))

      expect(performance.now() - started).toBeLessThan(1000)
      expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
      expect(portfolio.cashAfterTrades.lessThan(1)).toBe(true)
    })

    it.each([NaN, Infinity, -Infinity])('rejects the deposit %d', (deposit) => {
      const portfolio = buildPortfolio()

      expect(() => portfolio.allocateCash(new Decimal(deposit)))
        .toThrow(`Deposit must be a finite number (${deposit})`)
      expect(sharesOf(portfolio)).toEqual({ QDVE: 100, SPYD: 100 })
    })
  })

  describe('buyWithCash', () => {
    const three = () => new Portfolio({
      securities: [
        security({ tick: 'A', price: 10, shares: 50, targetPercentage: 0.5 }),
        security({ tick: 'B', price: 20, shares: 10, targetPercentage: 0.3 }),
        security({ tick: 'C', price: 5, shares: 20, targetPercentage: 0.2 }),
      ],
    })

    it('brings the most underweight security up first and sells nothing', () => {
      // Example portfolio: QDVE is 31% (target 40%), so 1000 all goes to QDVE: 35 shares,
      // 995.75 + 1 fee. Neither 28.45 nor 62.10 fits in the 3.25 left.
      const portfolio = buildPortfolio()

      portfolio.buyWithCash(new Decimal(1000))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 135, SPYD: 100 })
      expect(portfolio.deposit.toNumber()).toBe(1000)
      expect(portfolio.cashAfterTrades.toNumber()).toBe(3.25)
    })

    it('fills underweight securities together once they reach the same weight gap', () => {
      // Value 500 + 200 + 100 = 800. Investing 400: B and C are underweight; at a value of 1200
      // A (500) is below 600 too, so all three get money, in proportion to their gaps.
      const portfolio = three()

      portfolio.buyWithCash(new Decimal(400))

      for (const sec of portfolio.securities) {
        expect(sec.shares).toBeGreaterThanOrEqual(sec.initialShares)
      }
      expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
      // Target values at 1200 are A 600, B 360, C 240. Rounding to the nearest share gives
      // 600 / 360 / 240, 3 too much with the fees, so one C is cancelled: 600 / 360 / 235.
      expect(sharesOf(portfolio)).toEqual({ A: 60, B: 18, C: 47 })
      expect(portfolio.cashAfterTrades.toNumber()).toBe(2)
    })

    it('leaves overweight securities alone when the money does not reach them', () => {
      const portfolio = three()

      portfolio.buyWithCash(new Decimal(50))

      // C (12.5%, target 20%) is the furthest below; A (62.5%) and B (25%) are left alone
      expect(sharesOf(portfolio).A).toBe(50)
      expect(portfolio.securities.every((sec) => sec.shares >= sec.initialShares)).toBe(true)
      expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
    })

    it('cancels buys when the fees would need more than the cash', () => {
      // 30 to spend, flat fee 5: rounding down buys 3 C (15) and 1 B (20) = 35 + fees 10
      const portfolio = new Portfolio({
        securities: [
          security({ tick: 'B', price: 20, shares: 10, targetPercentage: 0.5, brokerageFeeFlat: 5 }),
          security({ tick: 'C', price: 5, shares: 10, targetPercentage: 0.5, brokerageFeeFlat: 5 }),
        ],
      })

      portfolio.buyWithCash(new Decimal(30))

      expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
      expect(portfolio.securities.every((sec) => sec.shares >= sec.initialShares)).toBe(true)
      expect(portfolio.totalTradedPrice.greaterThan(0)).toBe(true)
    })

    it('spends the cash held as well', () => {
      const portfolio = buildPortfolio(undefined, 1000)

      portfolio.buyWithCash(new Decimal(0))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 135, SPYD: 100 })
      expect(portfolio.cashAfterTrades.toNumber()).toBe(3.25)
    })

    it('buys nothing with nothing to spend', () => {
      const portfolio = buildPortfolio()

      portfolio.buyWithCash(new Decimal(0))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 100, SPYD: 100 })
      expect(portfolio.totalTradingFee.toNumber()).toBe(0)
    })

    it('never sells or needs more than it was given, for any amount', () => {
      for (let deposit = 0; deposit <= 3000; deposit += 37) {
        const portfolio = three()
        portfolio.buyWithCash(new Decimal(deposit))
        expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
        expect(portfolio.securities.every((sec) => sec.shares >= sec.initialShares)).toBe(true)
        // Whatever is left can't buy a share of anything still half a share or more below
        // target (against holdings + cash), fees included
        const total = portfolio.totalPrice.plus(portfolio.cashAfterTrades)
        for (const sec of portfolio.securities) {
          const shortOf = total.times(sec.targetPercentage).minus(sec.totalPrice)
          if (shortOf.greaterThanOrEqualTo(sec.price.dividedBy(2))) {
            sec.shares += 1
            expect(portfolio.cashAfterTrades.lessThan(0)).toBe(true)
            sec.shares -= 1
          }
        }
      }
    })

    it('buys an expensive underweight security instead of piling into a cheap one', () => {
      // 990 to spend at 50/50: rounding down would skip A (its gap is 495, one share is 500)
      // and leave B overweight. Buying 1 A and 98 B lands exactly on target.
      const portfolio = new Portfolio({
        securities: [
          security({ tick: 'A', price: 500, shares: 10, targetPercentage: 0.5, brokerageFeeFlat: 0 }),
          security({ tick: 'B', price: 5, shares: 1000, targetPercentage: 0.5, brokerageFeeFlat: 0 }),
        ],
      })

      portfolio.buyWithCash(new Decimal(990))

      expect(sharesOf(portfolio)).toEqual({ A: 11, B: 1098 })
      expect(portfolio.cashAfterTrades.toNumber()).toBe(0)
    })

    it('cancels the buy that keeps the weights closest to target when fees overshoot', () => {
      // One A (999.99 + 5% fee = 1049.99) fits in 1123.45 if the cheap C buy is cut back
      const portfolio = new Portfolio({
        securities: [
          security({
            tick: 'A', price: 999.99, shares: 1, targetPercentage: 0.8,
            brokerageFeeFlat: 0, tradingFeePercentage: 0.05,
          }),
          security({ tick: 'B', price: 5000, shares: 1, targetPercentage: 0.1, brokerageFeeFlat: 0 }),
          security({ tick: 'C', price: 0.01, shares: 100, targetPercentage: 0.1, brokerageFeeFlat: 0 }),
        ],
      })

      portfolio.buyWithCash(new Decimal(1123.45))

      expect(sharesOf(portfolio).A).toBe(2)
      expect(sharesOf(portfolio).B).toBe(1)
      expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
      expect(portfolio.cashAfterTrades.lessThan(0.01)).toBe(true)
    })

    it('never pushes a security over target with the remainder', () => {
      // A is far over target; the 30 left over must not go to it
      const portfolio = new Portfolio({
        securities: [
          security({ tick: 'A', price: 10, shares: 90, targetPercentage: 0.5, brokerageFeeFlat: 0 }),
          security({ tick: 'B', price: 400, shares: 0, targetPercentage: 0.5, brokerageFeeFlat: 0 }),
        ],
      })

      portfolio.buyWithCash(new Decimal(30))

      expect(sharesOf(portfolio)).toEqual({ A: 90, B: 0 })
      expect(portfolio.cashAfterTrades.toNumber()).toBe(30)
    })

    it('keeps the money when a minimum fee makes even one share too expensive', () => {
      // B is far below target, but 5 buys neither 5 shares nor 1 share once its 3 + 2 fee is
      // added
      const portfolio = new Portfolio({
        securities: [
          security({
            tick: 'A', price: 28.45, shares: 22, targetPercentage: 0.55,
            brokerageFeeFlat: 1, tradingFeePercentage: 0.01, minimumTradingFeeFlat: 2,
          }),
          security({
            tick: 'B', price: 1, shares: 8, targetPercentage: 0.45,
            brokerageFeeFlat: 3, tradingFeePercentage: 0.01, minimumTradingFeeFlat: 2,
          }),
        ],
      })

      portfolio.buyWithCash(new Decimal(5))

      expect(sharesOf(portfolio)).toEqual({ A: 22, B: 8 })
      expect(portfolio.cashAfterTrades.toNumber()).toBe(5)
    })

    it('stays fast with very different prices', () => {
      const portfolio = new Portfolio({
        securities: [
          security({ tick: 'A', price: 100000, shares: 0, targetPercentage: 0.5 }),
          security({ tick: 'B', price: 0.01, shares: 0, targetPercentage: 0.5 }),
        ],
      })

      const started = performance.now()
      portfolio.buyWithCash(new Decimal(199999))

      expect(performance.now() - started).toBeLessThan(1000)
      expect(sharesOf(portfolio).A).toBe(1)
      expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
    })

    it('skips securities with a 0 target or a 0 price', () => {
      const portfolio = new Portfolio({
        securities: [
          security({ tick: 'ZERO', price: 10, shares: 0, targetPercentage: 0 }),
          security({ tick: 'FREE', price: 0, shares: 0, targetPercentage: 0.5 }),
          security({ tick: 'A', price: 10, shares: 0, targetPercentage: 0.5 }),
        ],
      })

      portfolio.buyWithCash(new Decimal(100))

      expect(sharesOf(portfolio)).toEqual({ ZERO: 0, FREE: 0, A: 9 })
    })

    it('buys nothing when no security can be bought', () => {
      const portfolio = new Portfolio({
        securities: [security({ tick: 'FREE', price: 0, shares: 0, targetPercentage: 1 })],
      })

      portfolio.buyWithCash(new Decimal(100))

      expect(portfolio.securities[0].shares).toBe(0)
      expect(portfolio.cashAfterTrades.toNumber()).toBe(100)
    })

    it.each([-1, NaN, Infinity])('rejects the deposit %d', (deposit) => {
      const portfolio = buildPortfolio()

      expect(() => portfolio.buyWithCash(new Decimal(deposit)))
        .toThrow(`A buy-only deposit must be a finite number of at least 0 (${deposit})`)
      expect(sharesOf(portfolio)).toEqual({ QDVE: 100, SPYD: 100 })
    })
  })

  describe('allocateValue', () => {
    it('allocates a target value of 5000 to QDVE 70 / SPYD 48', () => {
      const portfolio = buildPortfolio()

      portfolio.allocateValue(new Decimal(5000))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 70, SPYD: 48 })
    })

    it('trims the most overweight security when rounding goes above the value', () => {
      // Rounding alone gives QDVE 2 / SPYD 2, worth 181.10, for a value of 156
      const portfolio = buildPortfolio()

      portfolio.allocateValue(new Decimal(156))

      expect(sharesOf(portfolio)).toEqual({ QDVE: 2, SPYD: 1 })
      expect(portfolio.totalPrice.toNumber()).toBe(119)
    })

    it('never goes above the value, for any value', () => {
      for (let value = 1; value <= 2000; value += 13) {
        const portfolio = buildPortfolio()
        portfolio.allocateValue(new Decimal(value))
        expect(portfolio.totalPrice.lessThanOrEqualTo(value)).toBe(true)
      }
    })

    it('rejects an invalid value without changing any shares', () => {
      const portfolio = buildPortfolio()

      expect(() => portfolio.allocateValue(new Decimal(-1)))
        .toThrow('Portfolio price must be a finite number of at least 0 (-1)')
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

    it('copies the cash held and the planned deposit', () => {
      const portfolio = buildPortfolio(undefined, 12.5)
      portfolio.allocateCash(new Decimal(1000))

      const copy = portfolio.clone()

      expect(copy.cash.toNumber()).toBe(12.5)
      expect(copy.feeWarningPercentage.toNumber()).toBe(0.01)
      expect(copy.deposit.toNumber()).toBe(1000)
      expect(copy.cashAfterTrades.toNumber()).toBe(portfolio.cashAfterTrades.toNumber())
    })

    it('re-validates through the constructors', () => {
      const portfolio = buildPortfolio()
      Object.assign(portfolio.securities[0], { targetPercentage: new Decimal(0.5) })

      expect(() => portfolio.clone()).toThrow('Portfolio percentage don\'t add up to 1 (1.1)')
    })
  })
})
