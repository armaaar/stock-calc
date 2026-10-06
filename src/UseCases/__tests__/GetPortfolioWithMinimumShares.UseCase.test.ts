import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '@/__fixtures__/portfolio'
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { ClassValidatorError } from '@/Shared/ClassValidatorError'
import {
  DEFAULT_ACCEPTABLE_PRECESION,
  DEFAULT_SHARES_STEP,
  GetPortfolioWithMinimumSharesUseCase,
} from '.././GetPortfolioWithMinimumShares.UseCase'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

vi.mock('@/Repositories/Portfolio.Repository', () => ({
  PortfolioRepository: class {
    getPortfolio = getPortfolio
  },
}))

function sharesOf(portfolio: Portfolio) {
  return portfolio.securities.map((sec) => [sec.tick, sec.shares])
}

function validationErrorOf(fn: () => unknown): ClassValidatorError {
  try {
    fn()
  } catch (e) {
    return e as ClassValidatorError
  }
  throw new Error('Expected a validation error')
}

describe('GetPortfolioWithMinimumSharesUseCase', () => {
  beforeEach(() => {
    getPortfolio.mockReset().mockImplementation(async () => buildPortfolio())
  })

  it('exports a default precision of 0.01 and shares step of 1', () => {
    expect(DEFAULT_ACCEPTABLE_PRECESION).toBe(0.01)
    expect(DEFAULT_SHARES_STEP).toBe(1)
  })

  describe('constructor validation', () => {
    it.each([
      ['no arguments', undefined, undefined],
      ['precision 0 (falls back to the default)', 0, undefined],
      ['shares step 0 (falls back to the default)', undefined, 0],
      ['precision 1 and a large step', 1, 10],
      ['NaN arguments (fall back to the defaults)', NaN, NaN],
    ])('accepts %s', (_, precision, step) => {
      expect(() => new GetPortfolioWithMinimumSharesUseCase('EUR', precision, step))
        .not.toThrow()
    })

    it.each([
      ['a precision above 1', 1.5, undefined, 'acceptablePrecision'],
      ['a negative precision', -0.01, undefined, 'acceptablePrecision'],
      ['a fractional shares step', undefined, 1.5, 'sharesStep'],
      ['a negative shares step', undefined, -1, 'sharesStep'],
    ])('rejects %s', (_, precision, step, property) => {
      const error = validationErrorOf(
        () => new GetPortfolioWithMinimumSharesUseCase('EUR', precision, step),
      )

      expect(error).toBeInstanceOf(ClassValidatorError)
      expect(error.message)
        .toBe('Class \'GetPortfolioWithMinimumSharesUseCase\' validation failed')
      expect(error.errors.map((e) => e.property)).toEqual([property])
    })

    it('does not touch the repository while constructing', () => {
      new GetPortfolioWithMinimumSharesUseCase('EUR')

      expect(getPortfolio).not.toHaveBeenCalled()
    })
  })

  describe('handler', () => {
    it('finds QDVE 3 / SPYD 2 with the default precision', async () => {
      const portfolio = await new GetPortfolioWithMinimumSharesUseCase('EUR').handler()

      expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
      expect(sharesOf(portfolio)).toEqual([['QDVE', 3], ['SPYD', 2]])
      expect(portfolio.totalPrice.toNumber()).toBe(209.55)
      expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([100, 100])
    })

    it('uses the defaults when given 0 for precision and step', async () => {
      const portfolio = await new GetPortfolioWithMinimumSharesUseCase('EUR', 0, 0).handler()

      expect(sharesOf(portfolio)).toEqual([['QDVE', 3], ['SPYD', 2]])
    })

    it('finds QDVE 16 / SPYD 11 with precision 0.001', async () => {
      const portfolio = await new GetPortfolioWithMinimumSharesUseCase('EGP', 0.001).handler()

      expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
      expect(sharesOf(portfolio)).toEqual([['QDVE', 16], ['SPYD', 11]])
      expect(portfolio.totalPrice.toNumber()).toBe(1138.3)
    })

    it('keeps every share count a multiple of the shares step', async () => {
      const portfolio = await new GetPortfolioWithMinimumSharesUseCase('EUR', 0.01, 5).handler()

      expect(sharesOf(portfolio)).toEqual([['QDVE', 15], ['SPYD', 10]])
      portfolio.securities.forEach((sec) => expect(sec.shares % 5).toBe(0))
    })

    it('scales every other security from the first one', async () => {
      getPortfolio.mockImplementation(async () => buildPortfolio([
        { ...QDVE, targetPercentage: 0.5 },
        { ...SPYD, targetPercentage: 0.25 },
        {
          ...SPYD, tick: 'CASH', price: 1, targetPercentage: 0.25,
        },
      ]))

      const portfolio = await new GetPortfolioWithMinimumSharesUseCase('EUR').handler()

      portfolio.securities.forEach((sec) => {
        const drift = sec.calcActualPercentage(portfolio.totalPrice).minus(sec.targetPercentage)
        expect(drift.abs().toNumber()).toBeLessThanOrEqual(0.01)
      })
      // QDVE 9 = 256.05 → SPYD round(128.025 / 62.1) = 2, CASH round(128.025 / 1) = 128
      expect(sharesOf(portfolio)).toEqual([['QDVE', 9], ['SPYD', 2], ['CASH', 128]])
    })

    it('returns current holdings unchanged when they are already within precision', async () => {
      // Current behaviour: the acceptance test runs before the first iteration, so a
      // portfolio already within precision is returned as-is rather than minimised.
      getPortfolio.mockImplementation(async () => buildPortfolio([
        { ...QDVE, shares: 127 },
        { ...SPYD, shares: 87 },
      ]))

      const portfolio = await new GetPortfolioWithMinimumSharesUseCase('EUR').handler()

      expect(sharesOf(portfolio)).toEqual([['QDVE', 127], ['SPYD', 87]])
    })

    it('accepts any holdings with precision 1', async () => {
      const portfolio = await new GetPortfolioWithMinimumSharesUseCase('EUR', 1).handler()

      expect(sharesOf(portfolio)).toEqual([['QDVE', 100], ['SPYD', 100]])
    })
  })
})
