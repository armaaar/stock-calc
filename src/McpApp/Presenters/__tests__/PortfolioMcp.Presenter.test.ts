import { describe, expect, it } from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '@/__fixtures__/portfolio'
import { PortfolioMcpPresenter, PresentMode } from '.././PortfolioMcp.Presenter'

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

  it('ONLY_DELTA: only the securities being traded, with trade values', () => {
    const portfolio = buildPortfolio()
    portfolio.securities[0].shares = 110

    const { structuredContent } = PortfolioMcpPresenter.present(portfolio, PresentMode.ONLY_DELTA)

    expect(structuredContent).toEqual({
      currency: 'EUR',
      tradedPrice: 284.5,
      tradingFee: 1,
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
      }],
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
})
