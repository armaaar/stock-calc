import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import { GetPortfolioWithInvestmentUseCase } from '../GetPortfolioWithInvestment.UseCase'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

vi.mock('#src/Repositories/Portfolio.Repository', () => ({
  PortfolioRepository: class {
    getPortfolio = getPortfolio
  },
}))

function sharesOf(portfolio: Portfolio) {
  return portfolio.securities.map((sec) => [sec.tick, sec.shares])
}

describe('GetPortfolioWithInvestmentUseCase', () => {
  beforeEach(() => {
    getPortfolio.mockReset().mockImplementation(async () => buildPortfolio())
  })

  it('invests 1000 into QDVE 141 / SPYD 97, selling SPYD on the way', async () => {
    const portfolio = await new GetPortfolioWithInvestmentUseCase('EUR', 1000).handler()

    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
    expect(sharesOf(portfolio)).toEqual([['QDVE', 141], ['SPYD', 97]])
    expect(portfolio.securities[0].tradedPrice.toNumber()).toBe(1166.45)
    expect(portfolio.securities[1].tradedPrice.toNumber()).toBe(-186.3)
    expect(portfolio.totalTradedPrice.toNumber()).toBe(980.15)
    expect(portfolio.totalTradingFee.toNumber()).toBe(2)
    expect(portfolio.totalPrice.toNumber()).toBe(10035.15)
  })

  it('behaves like a rebalance when investing 0', async () => {
    const portfolio = await new GetPortfolioWithInvestmentUseCase('EUR', 0).handler()

    expect(sharesOf(portfolio)).toEqual([['QDVE', 127], ['SPYD', 87]])
  })

  it('accepts a negative investment as a withdrawal', async () => {
    // 9055 - 4055 = 5000 gives the same plan as `target 5000`.
    const portfolio = await new GetPortfolioWithInvestmentUseCase('EUR', -4055).handler()

    expect(sharesOf(portfolio)).toEqual([['QDVE', 70], ['SPYD', 48]])
  })

  it('accepts withdrawing the whole portfolio value', async () => {
    const portfolio = await new GetPortfolioWithInvestmentUseCase('EUR', -9055).handler()

    expect(sharesOf(portfolio)).toEqual([['QDVE', 0], ['SPYD', 0]])
  })

  it('rejects withdrawing more than the portfolio value', async () => {
    const useCase = new GetPortfolioWithInvestmentUseCase('EUR', -10000)

    await expect(useCase.handler())
      .rejects.toThrow('Cannot withdraw 10000: more than the portfolio value (9055)')
  })

  it.each([
    ['NaN (a non-numeric CLI argument)', Number('abc')],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('rejects %s in the constructor without loading the portfolio', (_, investment) => {
    let error: unknown
    try {
      new GetPortfolioWithInvestmentUseCase('EUR', investment)
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ClassValidatorError)
    const { message, errors } = error as ClassValidatorError
    expect(message).toBe('Class \'GetPortfolioWithInvestmentUseCase\' validation failed')
    expect(errors.map((e) => e.property)).toEqual(['investmentValue'])
    expect(getPortfolio).not.toHaveBeenCalled()
  })

  it('passes the portfolio type through to the repository', async () => {
    await new GetPortfolioWithInvestmentUseCase('EGP', 1).handler()

    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
  })
})
