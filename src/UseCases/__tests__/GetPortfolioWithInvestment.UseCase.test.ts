import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { buildPortfolio } from '@/__fixtures__/portfolio'
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { GetPortfolioWithInvestmentUseCase } from '.././GetPortfolioWithInvestment.UseCase'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

vi.mock('@/Repositories/Portfolio.Repository', () => ({
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
    // Current behaviour: the use case does not reject negative amounts (only the CLI parser
    // does); 9055 - 4055 = 5000 gives the same plan as `target 5000`.
    const portfolio = await new GetPortfolioWithInvestmentUseCase('EUR', -4055).handler()

    expect(sharesOf(portfolio)).toEqual([['QDVE', 70], ['SPYD', 48]])
  })

  it('passes the portfolio type through to the repository', async () => {
    await new GetPortfolioWithInvestmentUseCase('EGP', 1).handler()

    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
  })
})
