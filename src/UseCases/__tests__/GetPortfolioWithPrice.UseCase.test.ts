import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '@/__fixtures__/portfolio'
import { GetPortfolioWithPriceUseCase } from '.././GetPortfolioWithPrice.UseCase'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

vi.mock('@/Repositories/Portfolio.Repository', () => ({
  PortfolioRepository: class {
    getPortfolio = getPortfolio
  },
}))

describe('GetPortfolioWithPriceUseCase', () => {
  beforeEach(() => {
    getPortfolio.mockReset().mockImplementation(async () => buildPortfolio())
  })

  it('allocates a target value of 5000 to QDVE 70 / SPYD 48', async () => {
    const portfolio = await new GetPortfolioWithPriceUseCase('EUR', 5000).handler()

    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
    expect(portfolio.securities.map((sec) => [sec.tick, sec.shares]))
      .toEqual([['QDVE', 70], ['SPYD', 48]])
    expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([100, 100])
    expect(portfolio.totalPrice.toNumber()).toBe(4972.3)
    expect(portfolio.totalTradingFee.toNumber()).toBe(2)
  })

  it('ignores current holdings when computing the proposed shares', async () => {
    getPortfolio.mockImplementation(async () => buildPortfolio([
      { ...QDVE, shares: 1 },
      { ...SPYD, shares: 0 },
    ]))

    const portfolio = await new GetPortfolioWithPriceUseCase('EGP', 5000).handler()

    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([70, 48])
    expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([1, 0])
  })

  it('sells everything for a target of 0', async () => {
    const portfolio = await new GetPortfolioWithPriceUseCase('EUR', 0).handler()

    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([0, 0])
    expect(portfolio.totalTradedPrice.toNumber()).toBe(-9055)
  })

  it('produces NaN shares for a non-numeric target', async () => {
    // Current behaviour: NaN is not rejected and propagates into the share counts.
    const portfolio = await new GetPortfolioWithPriceUseCase('EUR', Number('abc')).handler()

    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([NaN, NaN])
  })
})
