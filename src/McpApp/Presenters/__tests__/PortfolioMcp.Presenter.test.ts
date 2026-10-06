import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  buildPortfolio, ICOM, QDVE, SPYD, USD_EUR,
} from '#src/__fixtures__/portfolio'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import {
  PortfolioMcpPresenter, portfolioOutputSchema, PresentMode,
} from '../PortfolioMcp.Presenter'

function plannedPortfolio() {
  // Buy 27 QDVE and sell 13 SPYD (the rebalance plan of the example portfolio)
  const portfolio = buildPortfolio()
  portfolio.securities[0].shares = 127
  portfolio.securities[1].shares = 87
  return portfolio
}

describe('PortfolioMcpPresenter', () => {
  it('returns the output as structured content and as JSON text', () => {
    const result = PortfolioMcpPresenter.present(buildPortfolio())

    expect(result.isError).toBeUndefined()
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(result.structuredContent, null, 2) },
    ])
  })

  it('ONLY_NEW (default): proposed holdings and value', () => {
    const { structuredContent } = PortfolioMcpPresenter.present(plannedPortfolio())

    expect(structuredContent).toEqual({
      currency: 'EUR',
      portfolioPrice: 9015.85,
      securities: [
        {
          tick: 'QDVE',
          exchange: 'IBIS2',
          currency: 'EUR',
          price: 28.45,
          targetPercent: 40,
          shares: 127,
          totalPrice: 3613.15,
          percent: 40.08,
        },
        {
          tick: 'SPYD',
          exchange: 'IBIS2',
          currency: 'EUR',
          price: 62.1,
          targetPercent: 60,
          shares: 87,
          totalPrice: 5402.7,
          percent: 59.92,
        },
      ],
    })
  })

  it('ONLY_INITIAL: current holdings and value, ignoring the plan', () => {
    const { structuredContent } = PortfolioMcpPresenter.present(
      plannedPortfolio(),
      PresentMode.ONLY_INITIAL,
    )

    expect(structuredContent).toMatchObject({
      portfolioPrice: 9055,
      securities: [
        { tick: 'QDVE', shares: 100, totalPrice: 2845, percent: 31.42 },
        { tick: 'SPYD', shares: 100, totalPrice: 6210, percent: 68.58 },
      ],
    })
  })

  it('WITH_DELTA: proposed holdings plus trades and fees', () => {
    const { structuredContent } = PortfolioMcpPresenter.present(
      plannedPortfolio(),
      PresentMode.WITH_DELTA,
    )

    expect(structuredContent).toMatchObject({
      portfolioPrice: 9015.85,
      tradedPrice: -39.15,
      tradingFee: 2,
      securities: [
        { tick: 'QDVE', shares: 127, tradedShares: 27, tradedPrice: 768.15, tradingFee: 1 },
        { tick: 'SPYD', shares: 87, tradedShares: -13, tradedPrice: -807.3, tradingFee: 1 },
      ],
    })
  })

  it('returns where and when each price was quoted', () => {
    const portfolio = buildPortfolio([
      { ...QDVE, priceSource: 'tradingview.com', pricedAt: '2026-10-06T09:30:00.000Z' },
      { ...SPYD, priceSource: 'override', pricedAt: '2026-10-01' },
    ])

    const { structuredContent } = PortfolioMcpPresenter.present(portfolio, PresentMode.ONLY_INITIAL)

    expect(structuredContent).toMatchObject({
      securities: [
        { tick: 'QDVE', priceSource: 'tradingview.com', pricedAt: '2026-10-06T09:30:00.000Z' },
        { tick: 'SPYD', priceSource: 'override', pricedAt: '2026-10-01' },
      ],
    })
  })

  it('ONLY_DELTA: only the securities being traded, with trade values', () => {
    const portfolio = buildPortfolio()
    portfolio.securities[0].shares = 110

    const { structuredContent } = PortfolioMcpPresenter.present(portfolio, PresentMode.ONLY_DELTA)

    expect(structuredContent).toEqual({
      currency: 'EUR',
      tradedPrice: 284.5,
      tradingFee: 1,
      cashAfterTrades: -285.5,
      warnings: [],
      securities: [{
        tick: 'QDVE',
        exchange: 'IBIS2',
        currency: 'EUR',
        price: 28.45,
        targetPercent: 40,
        shares: 10,
        totalPrice: 284.5,
        percent: 100,
        tradingFee: 1,
        feePercent: 0.35,
      }],
    })
  })

  it('ONLY_DELTA: percent is each trade\'s share of the gross value bought and sold', () => {
    const { structuredContent } = PortfolioMcpPresenter.present(
      plannedPortfolio(),
      PresentMode.ONLY_DELTA,
    )

    // 768.15 / (768.15 + 807.3) and 807.3 / (768.15 + 807.3), not relative to the net -39.15
    expect(structuredContent).toMatchObject({
      tradedPrice: -39.15,
      tradingFee: 2,
      securities: [
        { tick: 'QDVE', shares: 27, totalPrice: 768.15, percent: 48.76 },
        { tick: 'SPYD', shares: -13, totalPrice: -807.3, percent: 51.24 },
      ],
    })
  })

  it('ONLY_DELTA: no securities and zero totals when nothing is traded', () => {
    const { structuredContent } = PortfolioMcpPresenter.present(
      buildPortfolio(),
      PresentMode.ONLY_DELTA,
    )

    expect(structuredContent).toEqual({
      currency: 'EUR',
      tradedPrice: 0,
      tradingFee: 0,
      cashAfterTrades: 0,
      warnings: [],
      securities: [],
    })
  })

  it('omits optional identity fields the securities do not have', () => {
    const portfolio = buildPortfolio([
      { ...QDVE, exchange: undefined, currency: undefined },
      { ...SPYD, exchange: undefined, currency: undefined },
    ])

    const { structuredContent } = PortfolioMcpPresenter.present(portfolio)
    const [security] = (structuredContent as { securities: object[] }).securities

    expect(JSON.parse(JSON.stringify(structuredContent))).not.toHaveProperty('currency')
    expect(security).not.toHaveProperty('exchange', expect.anything())
  })

  it('throws on an unknown present mode', () => {
    expect(() => PortfolioMcpPresenter.present(buildPortfolio(), 42 as PresentMode))
      .toThrow('Unknown present mode \'42\'')
  })

  it('returns the portfolio id, converted prices with their listed price, and the rates', () => {
    const portfolio = new Portfolio({
      id: 'ibkr/eur',
      currency: 'EUR',
      securities: [
        new PortfolioSecurity({ ...QDVE, targetPercentage: 0.4 }),
        new PortfolioSecurity({ ...ICOM, shares: 110, initialShares: 100 }),
      ],
    })

    const { structuredContent } = PortfolioMcpPresenter.present(portfolio, PresentMode.WITH_DELTA)

    // What clients validate against
    expect(z.object(portfolioOutputSchema).strict().parse(structuredContent))
      .toEqual(structuredContent)
    expect(structuredContent).toMatchObject({
      portfolio: 'ibkr/eur',
      currency: 'EUR',
      rates: [USD_EUR],
      securities: [
        { tick: 'QDVE', price: 28.45 },
        {
          tick: 'ICOM', price: 37.08, listedPrice: 41.2, listedCurrency: 'USD', exchangeRate: 0.9,
        },
      ],
    })
  })
})
