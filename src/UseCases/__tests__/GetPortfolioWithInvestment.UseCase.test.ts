import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
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

  it('does not buy only by default', () => {
    expect(new Investment(1000).buyOnly).toBe(false)
  })

  it.each([0, 1000])('accepts buying only with %d', (amount) => {
    expect(new Investment(amount, true)).toMatchObject({ amount, buyOnly: true })
  })

  it('rejects buying only with a negative amount', () => {
    let error: unknown
    try {
      new Investment(-1, true)
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ClassValidatorError)
    expect((error as ClassValidatorError).errors.map((e) => e.property))
      .toEqual(['buyOnlyAmount'])
  })
})

describe('GetPortfolioWithInvestmentUseCase', () => {
  let repo: FakePortfolioRepository
  let useCase: GetPortfolioWithInvestmentUseCase

  beforeEach(() => {
    repo = fakePortfolioRepository()
    useCase = new GetPortfolioWithInvestmentUseCase(repo)
  })

  const invest = (investment: number, portfolio = 'ibkr/eur') => (
    useCase.execute({ portfolio, investment })
  )

  it('invests 1000 into QDVE 141 / SPYD 97, selling SPYD on the way', async () => {
    const portfolio = await invest(1000)

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('ibkr/eur')
    expect(sharesOf(portfolio)).toEqual([['QDVE', 141], ['SPYD', 97]])
    expect(portfolio.securities[0].tradedPrice.toNumber()).toBe(1166.45)
    expect(portfolio.securities[1].tradedPrice.toNumber()).toBe(-186.3)
    expect(portfolio.totalTradedPrice.toNumber()).toBe(980.15)
    expect(portfolio.totalTradingFee.toNumber()).toBe(2)
    expect(portfolio.totalPrice.toNumber()).toBe(10035.15)
    expect(portfolio.cashAfterTrades.toNumber()).toBe(17.85)
  })

  it('never plans to spend more than the investment, fees included', async () => {
    // Rounding alone would sell one SPYD fewer and need 24.95
    const portfolio = await invest(2)

    expect(sharesOf(portfolio)).toEqual([['QDVE', 127], ['SPYD', 87]])
    expect(portfolio.cashAfterTrades.toNumber()).toBe(39.15)
  })

  it('invests the cash the portfolio already holds as well', async () => {
    repo.getPortfolio.mockImplementation(async () => buildPortfolio(undefined, 500))

    const portfolio = await invest(500)

    expect(portfolio.deposit.toNumber()).toBe(500)
    expect(portfolio.cashAfterTrades.greaterThanOrEqualTo(0)).toBe(true)
    expect(portfolio.totalPrice.toNumber()).toBeGreaterThan(9055 + 1000 - 62.1 - 2)
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

  it('accepts withdrawing the whole portfolio value, showing the fees as a shortfall', async () => {
    const portfolio = await invest(-9055)

    expect(sharesOf(portfolio)).toEqual([['QDVE', 0], ['SPYD', 0]])
    expect(portfolio.cashAfterTrades.toNumber()).toBe(-2)
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

  describe('buying only', () => {
    it('buys 35 QDVE with 1000 and sells nothing', async () => {
      const portfolio = await useCase.execute({
        portfolio: 'ibkr/eur', investment: 1000, buyOnly: true,
      })

      expect(sharesOf(portfolio)).toEqual([['QDVE', 135], ['SPYD', 100]])
      expect(portfolio.cashAfterTrades.toNumber()).toBe(3.25)
    })

    it('rejects a negative investment without loading the portfolio', async () => {
      const error = await useCase.execute({
        portfolio: 'ibkr/eur', investment: -100, buyOnly: true,
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ClassValidatorError)
      expect(repo.getPortfolio).not.toHaveBeenCalled()
    })
  })

  it('passes the portfolio type through to the repository', async () => {
    await invest(1, 'thndr/egp')

    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('thndr/egp')
  })
})
