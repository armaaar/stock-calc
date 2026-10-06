import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import { GetPortfolioWithPriceUseCase } from '../GetPortfolioWithPrice.UseCase'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

vi.mock('#src/Repositories/Portfolio.Repository', () => ({
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

  it.each([
    ['0', 0],
    ['a negative price', -5000],
    ['NaN (a non-numeric CLI argument)', Number('abc')],
    ['Infinity', Infinity],
  ])('rejects %s in the constructor without loading the portfolio', (_, price) => {
    let error: unknown
    try {
      new GetPortfolioWithPriceUseCase('EUR', price)
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ClassValidatorError)
    const { message, errors } = error as ClassValidatorError
    expect(message).toBe('Class \'GetPortfolioWithPriceUseCase\' validation failed')
    expect(errors.map((e) => e.property)).toEqual(['targetPriceValue'])
    expect(getPortfolio).not.toHaveBeenCalled()
  })

  it('accepts a tiny positive price', async () => {
    const portfolio = await new GetPortfolioWithPriceUseCase('EUR', 0.01).handler()

    expect(portfolio.securities.map((sec) => sec.shares)).toEqual([0, 0])
    expect(portfolio.totalTradedPrice.toNumber()).toBe(-9055)
  })
})
