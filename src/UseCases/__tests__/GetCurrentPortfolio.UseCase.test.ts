import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
import { FakePortfolioRepository, fakePortfolioRepository } from '#src/__fixtures__/repository'
import { GetCurrentPortfolioUseCase } from '../GetCurrentPortfolio.UseCase'

describe('GetCurrentPortfolioUseCase', () => {
  let repo: FakePortfolioRepository
  let useCase: GetCurrentPortfolioUseCase

  beforeEach(() => {
    repo = fakePortfolioRepository()
    useCase = new GetCurrentPortfolioUseCase(repo)
  })

  it('returns the loaded portfolio unchanged', async () => {
    const portfolio = await useCase.execute({ portfolio: 'ibkr/eur' })

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('ibkr/eur')
    expect(portfolio.securities.map((sec) => [sec.tick, sec.shares, sec.initialShares]))
      .toEqual([['QDVE', 100, 100], ['SPYD', 100, 100]])
    expect(portfolio.totalPrice.toNumber()).toBe(9055)
    expect(portfolio.totalTradingFee.toNumber()).toBe(0)
  })

  it('returns exactly the instance the repository built', async () => {
    const loaded = buildPortfolio()
    repo.getPortfolio.mockResolvedValueOnce(loaded)

    await expect(useCase.execute({ portfolio: 'thndr/egp' })).resolves.toBe(loaded)
    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('thndr/egp')
  })

  it('propagates repository errors', async () => {
    repo.getPortfolio.mockRejectedValueOnce(new Error('no settings'))

    await expect(useCase.execute({ portfolio: 'NOPE' })).rejects.toThrow('no settings')
  })

  it('loads the portfolio again on every execution (the use case keeps no state)', async () => {
    const first = await useCase.execute({ portfolio: 'ibkr/eur' })
    const second = await useCase.execute({ portfolio: 'thndr/egp' })

    expect(first).not.toBe(second)
    expect(repo.getPortfolio.mock.calls).toEqual([['ibkr/eur'], ['thndr/egp']])
  })
})
