import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import {
  assertPresentMode, PresentMode, toPortfolioView,
} from '../PortfolioView.ViewModel'

/** The example portfolio after `rebalance`: buy 27 QDVE, sell 13 SPYD. */
function rebalanced() {
  const portfolio = buildPortfolio()
  portfolio.balanceForPrice(portfolio.totalPrice)
  return portfolio
}

const identity = {
  QDVE: { tick: 'QDVE', exchange: 'IBIS2', currency: 'EUR', price: 28.45, targetPercent: 40 },
  SPYD: { tick: 'SPYD', exchange: 'IBIS2', currency: 'EUR', price: 62.1, targetPercent: 60 },
}

describe('PresentMode', () => {
  it('has stable numeric values', () => {
    expect([
      PresentMode.ONLY_NEW,
      PresentMode.ONLY_INITIAL,
      PresentMode.ONLY_DELTA,
      PresentMode.WITH_DELTA,
    ]).toEqual([0, 1, 2, 3])
  })
})

describe('assertPresentMode', () => {
  it.each([0, 1, 2, 3])('accepts %i', (mode) => {
    expect(() => assertPresentMode(mode)).not.toThrow()
  })

  it.each([
    [99 as PresentMode, '99'],
    [-1 as PresentMode, '-1'],
    ['ONLY_NEW' as unknown as PresentMode, 'ONLY_NEW'],
  ])('rejects %j', (mode, shown) => {
    expect(() => assertPresentMode(mode)).toThrow(`Unknown present mode '${shown}'`)
  })
})

describe('toPortfolioView', () => {
  it('ONLY_NEW (default): the proposed holdings and value, without trades', () => {
    expect(toPortfolioView(rebalanced())).toEqual({
      currency: 'EUR',
      portfolioPrice: 9015.85,
      securities: [
        { ...identity.QDVE, shares: 127, totalPrice: 3613.15, percent: 40.08 },
        { ...identity.SPYD, shares: 87, totalPrice: 5402.7, percent: 59.92 },
      ],
    })
  })

  it('ONLY_INITIAL: the current holdings and value, ignoring the plan', () => {
    expect(toPortfolioView(rebalanced(), PresentMode.ONLY_INITIAL)).toEqual({
      currency: 'EUR',
      portfolioPrice: 9055,
      cash: 0,
      securities: [
        { ...identity.QDVE, shares: 100, totalPrice: 2845, percent: 31.42 },
        { ...identity.SPYD, shares: 100, totalPrice: 6210, percent: 68.58 },
      ],
    })
  })

  it('ONLY_DELTA: the trades, their fees and the net cash, without a portfolio value', () => {
    expect(toPortfolioView(rebalanced(), PresentMode.ONLY_DELTA)).toEqual({
      currency: 'EUR',
      tradedPrice: -39.15,
      tradingFee: 2,
      cashAfterTrades: 37.15,
      warnings: [],
      securities: [
        {
          ...identity.QDVE,
          shares: 27,
          totalPrice: 768.15,
          percent: 48.76,
          tradingFee: 1,
          feePercent: 0.13,
        },
        {
          ...identity.SPYD,
          shares: -13,
          totalPrice: -807.3,
          percent: 51.24,
          tradingFee: 1,
          feePercent: 0.12,
        },
      ],
    })
  })

  it('ONLY_DELTA: leaves out securities that are not traded', () => {
    const portfolio = buildPortfolio()
    portfolio.securities[0].shares = 110

    const view = toPortfolioView(portfolio, PresentMode.ONLY_DELTA)

    expect(view.securities.map(({ tick, shares, percent }) => ({ tick, shares, percent })))
      .toEqual([{ tick: 'QDVE', shares: 10, percent: 100 }])
  })

  it('ONLY_DELTA: no securities and zero totals when nothing is traded', () => {
    expect(toPortfolioView(buildPortfolio(), PresentMode.ONLY_DELTA)).toEqual({
      currency: 'EUR',
      securities: [],
      tradedPrice: 0,
      tradingFee: 0,
      cashAfterTrades: 0,
      warnings: [],
    })
  })

  it('WITH_DELTA: the proposed holdings together with trades, fees and both totals', () => {
    expect(toPortfolioView(rebalanced(), PresentMode.WITH_DELTA)).toEqual({
      currency: 'EUR',
      portfolioPrice: 9015.85,
      tradedPrice: -39.15,
      tradingFee: 2,
      cashAfterTrades: 37.15,
      warnings: [],
      securities: [
        {
          ...identity.QDVE,
          shares: 127,
          totalPrice: 3613.15,
          percent: 40.08,
          tradedShares: 27,
          tradedPrice: 768.15,
          tradingFee: 1,
          feePercent: 0.13,
        },
        {
          ...identity.SPYD,
          shares: 87,
          totalPrice: 5402.7,
          percent: 59.92,
          tradedShares: -13,
          tradedPrice: -807.3,
          tradingFee: 1,
          feePercent: 0.12,
        },
      ],
    })
  })

  it('ONLY_INITIAL: shows the cash held next to the value of the holdings', () => {
    const view = toPortfolioView(buildPortfolio(undefined, 250.5), PresentMode.ONLY_INITIAL)

    expect(view).toMatchObject({ portfolioPrice: 9055, cash: 250.5 })
    expect(view).not.toHaveProperty('cashAfterTrades')
  })

  it('WITH_DELTA and ONLY_DELTA: the cash left counts the cash held and the money added', () => {
    const portfolio = buildPortfolio(undefined, 100)
    portfolio.allocateCash(new Decimal(1000))

    // 100 held + 1000 added - 980.15 net bought (41 QDVE, -3 SPYD) - 2 fees
    for (const mode of [PresentMode.WITH_DELTA, PresentMode.ONLY_DELTA]) {
      const view = toPortfolioView(portfolio, mode)
      expect(view.cashAfterTrades).toBeCloseTo(100 + 1000 - view.tradedPrice! - 2, 10)
      expect(view).not.toHaveProperty('cash')
    }
  })

  it('ONLY_NEW: leaves out cash, since a target state has no trades', () => {
    expect(toPortfolioView(buildPortfolio(undefined, 5))).not.toHaveProperty('cash')
    expect(toPortfolioView(buildPortfolio(undefined, 5))).not.toHaveProperty('cashAfterTrades')
  })

  it('warns about each order whose fee is more than the warning percentage of its value', () => {
    // A 3 EUR flat fee: 3 / 284.5 (10 QDVE) is 1.05%, 3 / 621 (10 SPYD) is 0.48%
    const portfolio = buildPortfolio([
      { ...QDVE, brokerageFeeFlat: 3 },
      { ...SPYD, brokerageFeeFlat: 3 },
    ])
    portfolio.securities[0].shares = 110
    portfolio.securities[1].shares = 90

    for (const mode of [PresentMode.WITH_DELTA, PresentMode.ONLY_DELTA]) {
      const view = toPortfolioView(portfolio, mode)

      expect(view.securities.map((sec) => sec.feePercent)).toEqual([1.05, 0.48])
      expect(view.warnings).toEqual([
        'QDVE: the 3 EUR fee is 1.05% of the 284.5 EUR order (more than 1%)',
      ])
    }
  })

  it('uses the portfolio\'s own warning percentage and leaves out the currency it lacks', () => {
    const portfolio = new Portfolio({
      securities: [
        new PortfolioSecurity({ ...QDVE, currency: undefined, brokerageFeeFlat: 3 }),
        new PortfolioSecurity({ ...SPYD, currency: undefined, brokerageFeeFlat: 3 }),
      ],
      feeWarningPercentage: 0.004,
    })
    portfolio.securities[1].shares = 90

    expect(toPortfolioView(portfolio, PresentMode.WITH_DELTA).warnings).toEqual([
      'SPYD: the 3 fee is 0.48% of the 621 order (more than 0.4%)',
    ])
  })

  it('has no fee percentages or warnings without trades to show', () => {
    for (const mode of [PresentMode.ONLY_NEW, PresentMode.ONLY_INITIAL]) {
      const view = toPortfolioView(rebalanced(), mode)

      expect(view).not.toHaveProperty('warnings')
      expect(view.securities[0]).not.toHaveProperty('feePercent')
    }
  })

  it('keeps a missing exchange or currency undefined for the interface to fill in', () => {
    const portfolio = buildPortfolio([
      { ...QDVE, exchange: undefined, currency: undefined },
      { ...SPYD, exchange: undefined, currency: undefined },
    ])

    const view = toPortfolioView(portfolio)

    expect(view.currency).toBeUndefined()
    expect(view.securities[0]).toMatchObject({ exchange: undefined, currency: undefined })
  })

  it('throws on an unknown mode', () => {
    expect(() => toPortfolioView(buildPortfolio(), 42 as PresentMode))
      .toThrow('Unknown present mode \'42\'')
  })
})
