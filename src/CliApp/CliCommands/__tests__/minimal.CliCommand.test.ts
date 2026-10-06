import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from 'class-validator'
import { ClassValidatorError } from '@/Shared/ClassValidatorError'
import { buildPortfolio, QDVE, SPYD } from '@/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '@/__fixtures__/console'
import {
  DEFAULT_ACCEPTABLE_PRECESION, DEFAULT_SHARES_STEP,
} from '@/UseCases/GetPortfolioWithMinimumShares.UseCase'
import { PortfolioCliPresenter } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { minimalCli } from '.././minimal.CliCommand'

const { UseCase, handler } = vi.hoisted(() => {
  const handler = vi.fn()
  const UseCase = vi.fn(function GetPortfolioWithMinimumSharesUseCase() {
    return { handler }
  })
  return { UseCase, handler }
})

vi.mock('@/UseCases/GetPortfolioWithMinimumShares.UseCase', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/UseCases/GetPortfolioWithMinimumShares.UseCase')>(),
  GetPortfolioWithMinimumSharesUseCase: UseCase,
}))

describe('minimal command', () => {
  let spies: ConsoleSpies

  beforeEach(() => {
    vi.clearAllMocks()
    spies = spyOnConsole()
    // The minimal example portfolio with the default precision: QDVE 3 / SPYD 2.
    handler.mockResolvedValue(buildPortfolio([
      { ...QDVE, shares: 3, initialShares: 100 },
      { ...SPYD, shares: 2, initialShares: 100 },
    ]))
  })

  it('is named "minimal" and takes precision, shares step and portfolio options', () => {
    expect(minimalCli.name()).toBe('minimal')
    expect(minimalCli.description()).toBe(
      'Calculates the minimum number of shares you need to buy to satisfy your portfolio',
    )
    expect(minimalCli.registeredArguments).toHaveLength(0)
    expect(minimalCli.options.map((option) => [option.short, option.long, option.defaultValue]))
      .toEqual([
        ['-p', '--precision', String(DEFAULT_ACCEPTABLE_PRECESION)],
        ['-s', '--shares-step', String(DEFAULT_SHARES_STEP)],
        ['--pt', '--portfolio', 'EUR'],
      ])
  })

  it('uses the default precision and shares step and presents only the new state', async () => {
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await minimalCli.parseAsync([], { from: 'user' })

    expect(UseCase).toHaveBeenCalledTimes(1)
    expect(UseCase).toHaveBeenCalledWith('EUR', 0.01, 1)
    expect(handler).toHaveBeenCalledTimes(1)
    // No mode is passed, so the presenter falls back to PresentMode.ONLY_NEW.
    expect(present).toHaveBeenCalledWith(await handler.mock.results[0].value)
    expect(present.mock.calls[0]).toHaveLength(1)
    expect(printedLines(spies.log)).toEqual(['Portfolio Price: 209.55 EUR', ''])
    expect(spies.error).not.toHaveBeenCalled()
  })

  it.each([
    [['-p', '0.001', '-s', '5'], ['EUR', 0.001, 5]],
    [['--precision', '0.05', '--shares-step', '2'], ['EUR', 0.05, 2]],
    [['--pt', 'EGP'], ['EGP', 0.01, 1]],
    [['--portfolio', 'EGP', '-p', '0.1'], ['EGP', 0.1, 1]],
  ])('converts the options %j to the use case arguments', async (argv, expected) => {
    await minimalCli.parseAsync(argv, { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith(...expected)
  })

  it('passes zero and NaN through to the use case unchanged', async () => {
    // Current behaviour: the CLI does not validate them; the use case silently falls back
    // to its defaults for falsy values (0 and NaN).
    await minimalCli.parseAsync(['-p', '0', '-s', 'abc'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('EUR', 0, NaN)
  })

  it('routes a validation error from the use case constructor to the error presenter', async () => {
    const error = new ClassValidatorError(
      'Class \'GetPortfolioWithMinimumSharesUseCase\' validation failed',
      [Object.assign(new ValidationError(), {
        property: 'sharesStep',
        constraints: { isInt: 'sharesStep must be an integer number' },
      })],
    )
    UseCase.mockImplementationOnce(function GetPortfolioWithMinimumSharesUseCase() {
      throw error
    })
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await minimalCli.parseAsync(['-s', '1.5'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('EUR', 0.01, 1.5)
    expect(presentError).toHaveBeenCalledWith(error)
    expect(present).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
    expect(printedLines(spies.error)[0]).toBe(
      'ClassValidatorError: Class \'GetPortfolioWithMinimumSharesUseCase\' validation failed',
    )
    expect(spies.table).toHaveBeenCalledWith({ isInt: 'sharesStep must be an integer number' })
  })

  it('routes a failing handler to the error presenter', async () => {
    const error = new Error('Settings file not found')
    handler.mockRejectedValueOnce(error)
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')

    await minimalCli.parseAsync([], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith(error)
    expect(printedLines(spies.error)).toEqual(['Error: Settings file not found'])
  })
})
