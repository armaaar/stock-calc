import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { FakePortfolioRepository, fakePortfolioRepository } from '#src/__fixtures__/repository'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import { GetPortfolioWithPriceUseCase, TargetPrice } from '../GetPortfolioWithPrice.UseCase'

describe('TargetPrice', () => {
  it('keeps a positive amount', () => {
    expect(new TargetPrice(5000).amount).toBe(5000)
  })
})

describe('GetPortfolioWithPriceUseCase', () => {
  let repo: FakePortfolioRepository
  let useCase: GetPortfolioWithPriceUseCase

  beforeEach(() => {
    repo = fakePortfolioRepository()
    useCase = new GetPortfolioWithPriceUseCase(repo)
  })

  it('allocates a target value of 5000 to QDVE 70 / SPYD 48', async () => {
    const portfolio = await useCase.execute({ portfolioType: 'EUR', targetPrice: 5000 })

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
    expect(portfolio.securities.map((sec) => [sec.tick, sec.shares]))
      .toEqual([['QDVE', 70], ['SPYD', 48]])
    expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([100, 100])
    expect(portfolio.totalPrice.toNumber()).toBe(4972.3)
    expect(portfolio.totalTradingFee.toNumber()).toBe(2)
  })

  it('ignores current holdings when computing the proposed shares', async () => {
    repo.getPortfolio.mockImplementation(async () => buildPortfolio([
      { ...QDVE, shares: 1 },
      { ...SPYD, shares: 0 },
    ]))

    const portfolio = await useCase.execute({ portfolioType: 'EGP', targetPrice: 5000 })

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([70, 48])
    expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([1, 0])
  })

  it.each([
    ['0', 0],
    ['a negative price', -5000],
    ['NaN (a non-numeric CLI argument)', Number('abc')],
    ['Infinity', Infinity],
  ])('rejects %s without loading the portfolio', async (_, targetPrice) => {
    const error = await useCase.execute({ portfolioType: 'EUR', targetPrice })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ClassValidatorError)
    const { message, errors } = error as ClassValidatorError
    expect(message).toBe('Class \'TargetPrice\' validation failed')
    expect(errors.map((e) => e.property)).toEqual(['amount'])
    expect(repo.getPortfolio).not.toHaveBeenCalled()
  })

  it('accepts a tiny positive price', async () => {
    const portfolio = await useCase.execute({ portfolioType: 'EUR', targetPrice: 0.01 })

    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([0, 0])
    expect(portfolio.totalTradedPrice.toNumber()).toBe(-9055)
  })
})
