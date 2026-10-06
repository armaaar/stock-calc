import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { FakePortfolioRepository, fakePortfolioRepository } from '#src/__fixtures__/repository'
import { GetRebalancedPortfolioUseCase } from '../GetRebalancedPortfolio.UseCase'

describe('GetRebalancedPortfolioUseCase', () => {
  let repo: FakePortfolioRepository
  let useCase: GetRebalancedPortfolioUseCase

  beforeEach(() => {
    repo = fakePortfolioRepository()
    useCase = new GetRebalancedPortfolioUseCase(repo)
  })

  it('rebalances the example portfolio to QDVE 127 / SPYD 87', async () => {
    const portfolio = await useCase.execute({ portfolioType: 'EUR' })

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
    expect(portfolio.securities.map((sec) => [sec.tick, sec.shares]))
      .toEqual([['QDVE', 127], ['SPYD', 87]])
    expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([100, 100])
  })

  it('reports the trade values and fees from the worked example', async () => {
    const portfolio = await useCase.execute({ portfolioType: 'EUR' })
    const [qdve, spyd] = portfolio.securities

    expect(qdve.tradedPrice.toNumber()).toBe(768.15)
    expect(spyd.tradedPrice.toNumber()).toBe(-807.3)
    expect(portfolio.totalTradingFee.toNumber()).toBe(2)
    expect(portfolio.totalTradedPrice.toNumber()).toBe(-39.15)
    expect(portfolio.totalPrice.toNumber()).toBe(9015.85)
    expect(portfolio.cashAfterTrades.toNumber()).toBe(37.15)
  })

  it('invests the cash the portfolio holds', async () => {
    repo.getPortfolio.mockImplementation(async () => buildPortfolio(undefined, 500))

    const portfolio = await useCase.execute({ portfolioType: 'EUR' })

    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([134, 92])
    expect(portfolio.deposit.toNumber()).toBe(0)
    expect(portfolio.cashAfterTrades.toNumber()).toBe(27.5)
  })

  it('leaves an already balanced portfolio untouched and fee-free', async () => {
    repo.getPortfolio.mockImplementation(async () => buildPortfolio([
      { ...QDVE, shares: 127 },
      { ...SPYD, shares: 87 },
    ]))

    const portfolio = await useCase.execute({ portfolioType: 'EGP' })

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([127, 87])
    expect(portfolio.totalTradingFee.toNumber()).toBe(0)
  })
})
