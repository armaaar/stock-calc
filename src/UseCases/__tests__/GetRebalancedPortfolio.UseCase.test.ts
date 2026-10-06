import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '@/__fixtures__/portfolio'
import { GetRebalancedPortfolioUseCase } from '../GetRebalancedPortfolio.UseCase'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

vi.mock('@/Repositories/Portfolio.Repository', () => ({
  PortfolioRepository: class {
    getPortfolio = getPortfolio
  },
}))

describe('GetRebalancedPortfolioUseCase', () => {
  beforeEach(() => {
    getPortfolio.mockReset().mockImplementation(async () => buildPortfolio())
  })

  it('rebalances the example portfolio to QDVE 127 / SPYD 87', async () => {
    const portfolio = await new GetRebalancedPortfolioUseCase('EUR').handler()

    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
    expect(portfolio.securities.map((sec) => [sec.tick, sec.shares]))
      .toEqual([['QDVE', 127], ['SPYD', 87]])
    expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([100, 100])
  })

  it('reports the trade values and fees from the worked example', async () => {
    const portfolio = await new GetRebalancedPortfolioUseCase('EUR').handler()
    const [qdve, spyd] = portfolio.securities

    expect(qdve.tradedPrice.toNumber()).toBe(768.15)
    expect(spyd.tradedPrice.toNumber()).toBe(-807.3)
    expect(portfolio.totalTradingFee.toNumber()).toBe(2)
    expect(portfolio.totalTradedPrice.toNumber()).toBe(-39.15)
    expect(portfolio.totalPrice.toNumber()).toBe(9015.85)
  })

  it('leaves an already balanced portfolio untouched and fee-free', async () => {
    getPortfolio.mockImplementation(async () => buildPortfolio([
      { ...QDVE, shares: 127 },
      { ...SPYD, shares: 87 },
    ]))

    const portfolio = await new GetRebalancedPortfolioUseCase('EGP').handler()

    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([127, 87])
    expect(portfolio.totalTradingFee.toNumber()).toBe(0)
  })
})
