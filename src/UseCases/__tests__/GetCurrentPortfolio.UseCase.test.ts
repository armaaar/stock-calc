import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { buildPortfolio } from '@/__fixtures__/portfolio'
import { GetCurrentPortfolioUseCase } from '.././GetCurrentPortfolio.UseCase'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

vi.mock('@/Repositories/Portfolio.Repository', () => ({
  PortfolioRepository: class {
    getPortfolio = getPortfolio
  },
}))

describe('GetCurrentPortfolioUseCase', () => {
  beforeEach(() => {
    getPortfolio.mockReset().mockImplementation(async () => buildPortfolio())
  })

  it('returns the loaded portfolio unchanged', async () => {
    const portfolio = await new GetCurrentPortfolioUseCase('EUR').handler()

    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
    expect(portfolio.securities.map((sec) => [sec.tick, sec.shares, sec.initialShares]))
      .toEqual([['QDVE', 100, 100], ['SPYD', 100, 100]])
    expect(portfolio.totalPrice.toNumber()).toBe(9055)
    expect(portfolio.totalTradingFee.toNumber()).toBe(0)
  })

  it('returns exactly the instance the repository built', async () => {
    const loaded = buildPortfolio()
    getPortfolio.mockResolvedValueOnce(loaded)

    await expect(new GetCurrentPortfolioUseCase('EGP').handler()).resolves.toBe(loaded)
    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
  })
})
