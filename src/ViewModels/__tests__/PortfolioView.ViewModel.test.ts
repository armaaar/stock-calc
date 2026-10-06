import { describe, expect, it } from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
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
      securities: [
        { ...identity.QDVE, shares: 27, totalPrice: 768.15, percent: 48.76, tradingFee: 1 },
        { ...identity.SPYD, shares: -13, totalPrice: -807.3, percent: 51.24, tradingFee: 1 },
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
    })
  })

  it('WITH_DELTA: the proposed holdings together with trades, fees and both totals', () => {
    expect(toPortfolioView(rebalanced(), PresentMode.WITH_DELTA)).toEqual({
      currency: 'EUR',
      portfolioPrice: 9015.85,
      tradedPrice: -39.15,
      tradingFee: 2,
      securities: [
        {
          ...identity.QDVE,
          shares: 127,
          totalPrice: 3613.15,
          percent: 40.08,
          tradedShares: 27,
          tradedPrice: 768.15,
          tradingFee: 1,
        },
        {
          ...identity.SPYD,
          shares: 87,
          totalPrice: 5402.7,
          percent: 59.92,
          tradedShares: -13,
          tradedPrice: -807.3,
          tradingFee: 1,
        },
      ],
    })
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
