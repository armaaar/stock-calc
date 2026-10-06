import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { FakePortfolioRepository, fakePortfolioRepository } from '#src/__fixtures__/repository'
import { GetCurrentPortfolioUseCase } from '../GetCurrentPortfolio.UseCase'
import { GetPortfolioWithInvestmentUseCase } from '../GetPortfolioWithInvestment.UseCase'
import { GetPortfolioWithMinimumSharesUseCase } from '../GetPortfolioWithMinimumShares.UseCase'
import { GetPortfolioWithPriceUseCase } from '../GetPortfolioWithPrice.UseCase'
import { GetRebalancedPortfolioUseCase } from '../GetRebalancedPortfolio.UseCase'
import { createPortfolioUseCases, PortfolioUseCases } from '../PortfolioUseCases.factory'

describe('createPortfolioUseCases', () => {
  let repo: FakePortfolioRepository
  let useCases: PortfolioUseCases

  beforeEach(() => {
    repo = fakePortfolioRepository()
    useCases = createPortfolioUseCases(repo)
  })

  it('keys every operation by its CLI command / MCP tool name', () => {
    expect(Object.keys(useCases).sort())
      .toEqual(['invest', 'minimal', 'rebalance', 'show', 'target'])
  })

  it.each([
    ['show', GetCurrentPortfolioUseCase],
    ['minimal', GetPortfolioWithMinimumSharesUseCase],
    ['target', GetPortfolioWithPriceUseCase],
    ['rebalance', GetRebalancedPortfolioUseCase],
    ['invest', GetPortfolioWithInvestmentUseCase],
  ] as const)('builds %s with the right use-case class', (key, UseCase) => {
    expect(useCases[key]).toBeInstanceOf(UseCase)
  })

  it('does not load anything while building the use cases', () => {
    expect(repo.getPortfolio).not.toHaveBeenCalled()
  })

  it('builds every use case over the given repository', async () => {
    await useCases.show.execute({ portfolioType: 'SHOW' })
    await useCases.minimal.execute({ portfolioType: 'MINIMAL' })
    await useCases.target.execute({ portfolioType: 'TARGET', targetPrice: 5000 })
    await useCases.rebalance.execute({ portfolioType: 'REBALANCE' })
    const invested = await useCases.invest.execute({ portfolioType: 'INVEST', investment: 1000 })

    expect(repo.getPortfolio.mock.calls)
      .toEqual([['SHOW'], ['MINIMAL'], ['TARGET'], ['REBALANCE'], ['INVEST']])
    expect(invested.securities.map((sec) => sec.shares)).toEqual([141, 97])
  })

  it('builds a separate set of use cases per call', () => {
    const other = createPortfolioUseCases(repo)

    expect(other.invest).not.toBe(useCases.invest)
    expect(other).not.toBe(useCases)
  })
})
