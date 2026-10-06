import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { FakePortfolioRepository, fakePortfolioRepository } from '#src/__fixtures__/repository'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import {
  GetPortfolioWithInvestmentUseCase, Investment,
} from '../GetPortfolioWithInvestment.UseCase'

function sharesOf(portfolio: Portfolio) {
  return portfolio.securities.map((sec) => [sec.tick, sec.shares])
}

describe('Investment', () => {
  it.each([1000, 0, -4055])('keeps the amount %d', (amount) => {
    expect(new Investment(amount).amount).toBe(amount)
  })
})

describe('GetPortfolioWithInvestmentUseCase', () => {
  let repo: FakePortfolioRepository
  let useCase: GetPortfolioWithInvestmentUseCase

  beforeEach(() => {
    repo = fakePortfolioRepository()
    useCase = new GetPortfolioWithInvestmentUseCase(repo)
  })

  const invest = (investment: number, portfolioType = 'EUR') => (
    useCase.execute({ portfolioType, investment })
  )

  it('invests 1000 into QDVE 141 / SPYD 97, selling SPYD on the way', async () => {
    const portfolio = await invest(1000)

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
    expect(sharesOf(portfolio)).toEqual([['QDVE', 141], ['SPYD', 97]])
    expect(portfolio.securities[0].tradedPrice.toNumber()).toBe(1166.45)
    expect(portfolio.securities[1].tradedPrice.toNumber()).toBe(-186.3)
    expect(portfolio.totalTradedPrice.toNumber()).toBe(980.15)
    expect(portfolio.totalTradingFee.toNumber()).toBe(2)
    expect(portfolio.totalPrice.toNumber()).toBe(10035.15)
  })

  it('behaves like a rebalance when investing 0', async () => {
    const portfolio = await invest(0)

    expect(sharesOf(portfolio)).toEqual([['QDVE', 127], ['SPYD', 87]])
  })

  it('accepts a negative investment as a withdrawal', async () => {
    // 9055 - 4055 = 5000 gives the same plan as `target 5000`.
    const portfolio = await invest(-4055)

    expect(sharesOf(portfolio)).toEqual([['QDVE', 70], ['SPYD', 48]])
  })

  it('accepts withdrawing the whole portfolio value', async () => {
    const portfolio = await invest(-9055)

    expect(sharesOf(portfolio)).toEqual([['QDVE', 0], ['SPYD', 0]])
  })

  it('rejects withdrawing more than the portfolio value', async () => {
    await expect(invest(-10000))
      .rejects.toThrow('Cannot withdraw 10000: more than the portfolio value (9055)')
  })

  it.each([
    ['NaN (a non-numeric CLI argument)', Number('abc')],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('rejects %s without loading the portfolio', async (_, investment) => {
    const error = await invest(investment).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ClassValidatorError)
    const { message, errors } = error as ClassValidatorError
    expect(message).toBe('Class \'Investment\' validation failed')
    expect(errors.map((e) => e.property)).toEqual(['amount'])
    expect(repo.getPortfolio).not.toHaveBeenCalled()
  })

  it('passes the portfolio type through to the repository', async () => {
    await invest(1, 'EGP')

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
  })
})
