import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationError } from 'class-validator'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import {
  DEFAULT_ACCEPTABLE_PRECESION, DEFAULT_SHARES_STEP,
} from '#src/UseCases/GetPortfolioWithMinimumShares.UseCase'
import { PortfolioCliPresenter } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { minimalCli } from '../minimal.CliCommand'

const { UseCase, handler } = vi.hoisted(() => {
  const handler = vi.fn()
  const UseCase = vi.fn(function GetPortfolioWithMinimumSharesUseCase() {
    return { handler }
  })
  return { UseCase, handler }
})

vi.mock('#src/UseCases/GetPortfolioWithMinimumShares.UseCase', async (importOriginal) => ({
  ...await importOriginal<typeof import('#src/UseCases/GetPortfolioWithMinimumShares.UseCase')>(),
  GetPortfolioWithMinimumSharesUseCase: UseCase,
}))

/** Makes process.exit throw instead of exiting and captures what commander writes to stderr. */
function interceptExit() {
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  return () => stderr.mock.calls.map(([chunk]) => String(chunk)).join('')
}

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

  afterEach(() => {
    process.exitCode = undefined
  })

  it('is named "minimal" and takes precision, shares step and portfolio options', () => {
    expect(minimalCli.name()).toBe('minimal')
    expect(minimalCli.description()).toBe(
      'Calculates the minimum number of shares you need to buy to satisfy your portfolio',
    )
    expect(minimalCli.registeredArguments).toHaveLength(0)
    expect(minimalCli.options.map((option) => [option.short, option.long, option.defaultValue]))
      .toEqual([
        ['-p', '--precision', DEFAULT_ACCEPTABLE_PRECESION],
        ['-s', '--shares-step', DEFAULT_SHARES_STEP],
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
    expect(process.exitCode).toBeUndefined()
  })

  it.each([
    [['-p', '0.001', '-s', '5'], ['EUR', 0.001, 5]],
    [['--precision', '0.05', '--shares-step', '2'], ['EUR', 0.05, 2]],
    [['--pt', 'EGP'], ['EGP', 0.01, 1]],
    [['--portfolio', 'EGP', '-p', '0.1'], ['EGP', 0.1, 1]],
    [['-p', '1e-3'], ['EUR', 0.001, 1]],
  ])('converts the options %j to the use case arguments', async (argv, expected) => {
    await minimalCli.parseAsync(argv, { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith(...expected)
  })

  it.each([
    [['-p', 'abc'], 'option \'-p, --precision <precision>\' argument \'abc\' is invalid.'],
    [['--precision', 'Infinity'], 'option \'-p, --precision <precision>\' argument \'Infinity\' is invalid.'],
    [['-s', 'abc'], 'option \'-s, --shares-step <step>\' argument \'abc\' is invalid.'],
    [['--shares-step', ''], 'option \'-s, --shares-step <step>\' argument \'\' is invalid.'],
  ])('rejects the non-numeric options %j with a usage error', async (argv, message) => {
    const stderr = interceptExit()

    await expect(minimalCli.parseAsync(argv, { from: 'user' })).rejects.toThrow('process.exit(1)')

    expect(stderr()).toBe(`error: ${message} Not a finite number.\n`)
    expect(UseCase).not.toHaveBeenCalled()
  })

  it('passes a zero precision through, so the use case can reject it', async () => {
    await minimalCli.parseAsync(['-p', '0', '-s', '0'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('EUR', 0, 0)
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
    expect(printedLines(spies.error)).toEqual([
      'ClassValidatorError: Class \'GetPortfolioWithMinimumSharesUseCase\' validation failed',
      '- Errors For \'sharesStep\'',
    ])
    expect(spies.table).toHaveBeenCalledWith({ isInt: 'sharesStep must be an integer number' })
    expect(process.exitCode).toBe(1)
  })

  it('routes a failing handler to the error presenter and sets exit code 1', async () => {
    const error = new Error('Settings file not found')
    handler.mockRejectedValueOnce(error)
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')

    await minimalCli.parseAsync([], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith(error)
    expect(printedLines(spies.error)).toEqual(['Error: Settings file not found'])
    expect(process.exitCode).toBe(1)
  })
})
