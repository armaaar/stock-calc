import Decimal from 'decimal.js'
import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { FakePortfolioRepository, fakePortfolioRepository } from '#src/__fixtures__/repository'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import {
  DEFAULT_ACCEPTABLE_PRECISION,
  DEFAULT_SHARES_STEP,
  GetPortfolioWithMinimumSharesUseCase,
  MAX_SEARCH_ITERATIONS,
  MinimumSharesSearch,
} from '../GetPortfolioWithMinimumShares.UseCase'

function sharesOf(portfolio: Portfolio) {
  return portfolio.securities.map((sec) => [sec.tick, sec.shares])
}

const INVALID_SEARCHES = [
  ['a precision above 1', 1.5, undefined, ['acceptablePrecision']],
  ['a negative precision', -0.01, undefined, ['acceptablePrecision']],
  ['a precision of 0 (unattainable)', 0, undefined, ['acceptablePrecision']],
  ['a NaN precision', NaN, undefined, ['acceptablePrecision']],
  ['an infinite precision', Infinity, undefined, ['acceptablePrecision']],
  ['a fractional shares step', undefined, 1.5, ['sharesStep']],
  ['a negative shares step', undefined, -1, ['sharesStep']],
  ['a shares step of 0', undefined, 0, ['sharesStep']],
  ['a NaN shares step', undefined, NaN, ['sharesStep']],
  ['NaN for both', NaN, NaN, ['acceptablePrecision', 'sharesStep']],
] as [string, number | undefined, number | undefined, string[]][]

function expectSearchValidationError(error: unknown, properties: string[]) {
  expect(error).toBeInstanceOf(ClassValidatorError)
  const { message, errors } = error as ClassValidatorError
  expect(message).toBe('Class \'MinimumSharesSearch\' validation failed')
  expect(errors.map((e) => e.property)).toEqual(properties)
}

describe('GetPortfolioWithMinimumSharesUseCase', () => {
  let repo: FakePortfolioRepository
  let useCase: GetPortfolioWithMinimumSharesUseCase

  beforeEach(() => {
    repo = fakePortfolioRepository()
    useCase = new GetPortfolioWithMinimumSharesUseCase(repo)
  })

  it('exports a default precision of 0.01, shares step of 1 and an iteration cap', () => {
    expect(DEFAULT_ACCEPTABLE_PRECISION).toBe(0.01)
    expect(DEFAULT_SHARES_STEP).toBe(1)
    expect(MAX_SEARCH_ITERATIONS).toBe(100_000)
  })

  describe('MinimumSharesSearch', () => {
    it('defaults the values that were not given', () => {
      expect(new MinimumSharesSearch()).toMatchObject({
        acceptablePrecision: DEFAULT_ACCEPTABLE_PRECISION,
        sharesStep: DEFAULT_SHARES_STEP,
      })
      expect(new MinimumSharesSearch(0.5))
        .toMatchObject({ acceptablePrecision: 0.5, sharesStep: 1 })
      expect(new MinimumSharesSearch(undefined, 5))
        .toMatchObject({ acceptablePrecision: 0.01, sharesStep: 5 })
    })

    it.each([
      ['no arguments', undefined, undefined],
      ['precision 1 and a large step', 1, 10],
      ['a tiny positive precision', 0.0001, undefined],
    ])('accepts %s', (_, precision, step) => {
      expect(() => new MinimumSharesSearch(precision, step)).not.toThrow()
    })

    it.each(INVALID_SEARCHES)('rejects %s', (_, precision, step, properties) => {
      let error: unknown
      try {
        new MinimumSharesSearch(precision, step)
      } catch (e) {
        error = e
      }

      expectSearchValidationError(error, properties)
    })
  })

  describe('request validation', () => {
    it.each(INVALID_SEARCHES)(
      'rejects %s without loading the portfolio',
      async (_, acceptablePrecision, sharesStep, properties) => {
        const error = await useCase
          .execute({ portfolioType: 'EUR', acceptablePrecision, sharesStep })
          .catch((e: unknown) => e)

        expectSearchValidationError(error, properties)
        expect(repo.getPortfolio).not.toHaveBeenCalled()
      },
    )

    it('does not touch the repository while constructing', () => {
      new GetPortfolioWithMinimumSharesUseCase(repo)

      expect(repo.getPortfolio).not.toHaveBeenCalled()
    })
  })

  describe('execute', () => {
    it('finds QDVE 3 / SPYD 2 with the default precision', async () => {
      const portfolio = await useCase.execute({ portfolioType: 'EUR' })

      expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('EUR')
      expect(sharesOf(portfolio)).toEqual([['QDVE', 3], ['SPYD', 2]])
      expect(portfolio.totalPrice.toNumber()).toBe(209.55)
      expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([100, 100])
    })

    it('finds QDVE 16 / SPYD 11 with precision 0.001', async () => {
      const portfolio = await useCase.execute({ portfolioType: 'EGP', acceptablePrecision: 0.001 })

      expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
      expect(sharesOf(portfolio)).toEqual([['QDVE', 16], ['SPYD', 11]])
      expect(portfolio.totalPrice.toNumber()).toBe(1138.3)
    })

    it('keeps every share count a multiple of the shares step', async () => {
      const portfolio = await useCase.execute({
        portfolioType: 'EUR', acceptablePrecision: 0.01, sharesStep: 5,
      })

      expect(sharesOf(portfolio)).toEqual([['QDVE', 15], ['SPYD', 10]])
      portfolio.securities.forEach((sec) => expect(sec.shares % 5).toBe(0))
    })

    it('uses the default precision when only the shares step is given', async () => {
      const portfolio = await useCase.execute({ portfolioType: 'EUR', sharesStep: 5 })

      expect(sharesOf(portfolio)).toEqual([['QDVE', 15], ['SPYD', 10]])
    })

    it('scales every other security from the first one', async () => {
      repo.getPortfolio.mockImplementation(async () => buildPortfolio([
        { ...QDVE, targetPercentage: 0.5 },
        { ...SPYD, targetPercentage: 0.25 },
        {
          ...SPYD, tick: 'CASH', price: 1, targetPercentage: 0.25,
        },
      ]))

      const portfolio = await useCase.execute({ portfolioType: 'EUR' })

      portfolio.securities.forEach((sec) => {
        const drift = sec.calcActualPercentage(portfolio.totalPrice).minus(sec.targetPercentage)
        expect(drift.abs().toNumber()).toBeLessThanOrEqual(0.01)
      })
      // QDVE 9 = 256.05 → SPYD round(128.025 / 62.1) = 2, CASH round(128.025 / 1) = 128
      expect(sharesOf(portfolio)).toEqual([['QDVE', 9], ['SPYD', 2], ['CASH', 128]])
    })

    it('minimises even when current holdings are already within precision', async () => {
      repo.getPortfolio.mockImplementation(async () => buildPortfolio([
        { ...QDVE, shares: 127 },
        { ...SPYD, shares: 87 },
      ]))

      const portfolio = await useCase.execute({ portfolioType: 'EUR' })

      expect(sharesOf(portfolio)).toEqual([['QDVE', 3], ['SPYD', 2]])
      expect(portfolio.securities.map((sec) => sec.initialShares)).toEqual([127, 87])
    })

    it('starts from one shares step with precision 1', async () => {
      const portfolio = await useCase.execute({ portfolioType: 'EUR', acceptablePrecision: 1 })

      expect(sharesOf(portfolio)).toEqual([['QDVE', 1], ['SPYD', 1]])
    })

    it('drives the search from the first security with a non-zero target', async () => {
      repo.getPortfolio.mockImplementation(async () => buildPortfolio([
        {
          ...QDVE, tick: 'ZERO', targetPercentage: 0,
        },
        QDVE,
        SPYD,
      ]))

      const portfolio = await useCase.execute({ portfolioType: 'EUR' })

      expect(sharesOf(portfolio)).toEqual([['ZERO', 0], ['QDVE', 3], ['SPYD', 2]])
    })

    it('gives 0 shares to every security with a 0 target, even one priced at 0', async () => {
      repo.getPortfolio.mockImplementation(async () => buildPortfolio([
        QDVE,
        {
          ...SPYD, tick: 'FREE', price: 0, targetPercentage: 0,
        },
        SPYD,
      ]))

      const portfolio = await useCase.execute({ portfolioType: 'EUR' })

      expect(sharesOf(portfolio)).toEqual([['QDVE', 3], ['FREE', 0], ['SPYD', 2]])
    })

    it('rejects a portfolio without any non-zero target', async () => {
      // The aggregate forbids this at construction; guard against a portfolio changed afterwards.
      const loaded = buildPortfolio()
      loaded.securities.forEach((sec) => {
        sec.targetPercentage = new Decimal(0)
      })
      repo.getPortfolio.mockResolvedValueOnce(loaded)

      await expect(useCase.execute({ portfolioType: 'EUR' }))
        .rejects.toThrow('Portfolio has no security with a target percentage above 0')
    })

    it('gives up with an error once the iteration cap is reached', async () => {
      class CappedUseCase extends GetPortfolioWithMinimumSharesUseCase {
        protected maxIterations = 2
      }
      const capped = new CappedUseCase(repo)

      await expect(capped.execute({ portfolioType: 'EUR' }))
        .rejects.toThrow('No portfolio within precision 0.01 found in 2 iterations')
      // The default precision needs a third step (QDVE 3 / SPYD 2); 0.1 is met at QDVE 1 / SPYD 1
      const portfolio = await capped.execute({ portfolioType: 'EUR', acceptablePrecision: 0.1 })
      expect(sharesOf(portfolio)).toEqual([['QDVE', 1], ['SPYD', 1]])
    })

    it('keeps no state between executions on the same instance', async () => {
      const coarse = await useCase.execute({ portfolioType: 'EUR', sharesStep: 5 })
      const fine = await useCase.execute({ portfolioType: 'EUR' })

      expect(sharesOf(coarse)).toEqual([['QDVE', 15], ['SPYD', 10]])
      expect(sharesOf(fine)).toEqual([['QDVE', 3], ['SPYD', 2]])
    })
  })
})
