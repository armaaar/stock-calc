import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'

const mocks = vi.hoisted(() => {
  const handler = vi.fn()
  const useCase = (name: string) => ({
    [name]: vi.fn(function UseCase() {
      return { handler }
    }),
  })[name]
  return {
    handler,
    GetCurrentPortfolioUseCase: useCase('GetCurrentPortfolioUseCase'),
    GetRebalancedPortfolioUseCase: useCase('GetRebalancedPortfolioUseCase'),
    GetPortfolioWithInvestmentUseCase: useCase('GetPortfolioWithInvestmentUseCase'),
    GetPortfolioWithPriceUseCase: useCase('GetPortfolioWithPriceUseCase'),
    GetPortfolioWithMinimumSharesUseCase: useCase('GetPortfolioWithMinimumSharesUseCase'),
  }
})

vi.mock('#src/UseCases/GetCurrentPortfolio.UseCase', () => ({
  GetCurrentPortfolioUseCase: mocks.GetCurrentPortfolioUseCase,
}))
vi.mock('#src/UseCases/GetRebalancedPortfolio.UseCase', () => ({
  GetRebalancedPortfolioUseCase: mocks.GetRebalancedPortfolioUseCase,
}))
vi.mock('#src/UseCases/GetPortfolioWithInvestment.UseCase', () => ({
  GetPortfolioWithInvestmentUseCase: mocks.GetPortfolioWithInvestmentUseCase,
}))
vi.mock('#src/UseCases/GetPortfolioWithPrice.UseCase', () => ({
  GetPortfolioWithPriceUseCase: mocks.GetPortfolioWithPriceUseCase,
}))
vi.mock('#src/UseCases/GetPortfolioWithMinimumShares.UseCase', () => ({
  DEFAULT_ACCEPTABLE_PRECESION: 0.01,
  DEFAULT_SHARES_STEP: 1,
  GetPortfolioWithMinimumSharesUseCase: mocks.GetPortfolioWithMinimumSharesUseCase,
}))

const originalArgv = process.argv

/** Runs src/CliApp/app.ts as if invoked with `tsx src/CliApp/app.ts ...args`. */
async function runApp(...args: string[]) {
  process.argv = ['node', 'src/CliApp/app.ts', ...args]
  vi.resetModules()
  await import('#src/CliApp/app')
}

/** Makes process.exit throw instead of exiting and captures stdout / stderr. */
function interceptExit() {
  const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  const written = (spy: typeof stdout) => spy.mock.calls.map(([chunk]) => String(chunk)).join('')
  return {
    exit,
    stdout: () => written(stdout),
    stderr: () => written(stderr),
  }
}

describe('CLI app', () => {
  let spies: ConsoleSpies

  beforeEach(() => {
    vi.clearAllMocks()
    spies = spyOnConsole()
    mocks.handler.mockResolvedValue(buildPortfolio())
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exitCode = undefined
  })

  it.each([
    [['show'], mocks.GetCurrentPortfolioUseCase, ['EUR']],
    [['rebalance', '--pt', 'EGP'], mocks.GetRebalancedPortfolioUseCase, ['EGP']],
    [['invest', '1000'], mocks.GetPortfolioWithInvestmentUseCase, ['EUR', 1000]],
    [['target', '5000', '--portfolio', 'EGP'], mocks.GetPortfolioWithPriceUseCase, ['EGP', 5000]],
    [['minimal', '-p', '0.001'], mocks.GetPortfolioWithMinimumSharesUseCase, ['EUR', 0.001, 1]],
  ])('dispatches %j to its use case', async (args, UseCase, expected) => {
    // The app awaits cli.parseAsync(), so the action has finished once the import resolves.
    await runApp(...args)

    expect(UseCase).toHaveBeenCalledTimes(1)
    expect(UseCase).toHaveBeenCalledWith(...expected)
    expect(mocks.handler).toHaveBeenCalledTimes(1)
    expect(printedLines(spies.log)).toContain('Portfolio Price: 9055 EUR')
  })

  it('passes a negative investment through as a number', async () => {
    await runApp('invest', '-100')

    expect(mocks.GetPortfolioWithInvestmentUseCase).toHaveBeenCalledWith('EUR', -100)
  })

  it('presents errors from the use case and sets exit code 1 without exiting early', async () => {
    const io = interceptExit()
    mocks.handler.mockRejectedValueOnce(new Error('Settings file not found'))

    await runApp('show')

    expect(printedLines(spies.error)).toEqual(['Error: Settings file not found'])
    expect(process.exitCode).toBe(1)
    expect(io.exit).not.toHaveBeenCalled()
  })

  it('leaves the exit code unset when the command succeeds', async () => {
    await runApp('show')

    expect(process.exitCode).toBeUndefined()
  })

  it('exits with a usage error for a non-numeric argument', async () => {
    const io = interceptExit()

    await expect(runApp('target', 'abc')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toBe(
      'error: command-argument value \'abc\' is invalid for argument \'price\'. '
      + 'Not a finite number.\n',
    )
    expect(mocks.GetPortfolioWithPriceUseCase).not.toHaveBeenCalled()
  })

  it('exits with a usage error for a non-numeric option', async () => {
    const io = interceptExit()

    await expect(runApp('minimal', '--shares-step', 'two')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toBe(
      'error: option \'-s, --shares-step <step>\' argument \'two\' is invalid. '
      + 'Not a finite number.\n',
    )
    expect(mocks.GetPortfolioWithMinimumSharesUseCase).not.toHaveBeenCalled()
  })

  it('exits with a usage error for an invalid portfolio name', async () => {
    const io = interceptExit()

    await expect(runApp('show', '--pt', '../EUR')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toBe(
      'error: option \'--pt, --portfolio <type>\' argument \'../EUR\' is invalid. '
      + 'Use letters, digits, \'_\' or \'-\'.\n',
    )
    expect(mocks.GetCurrentPortfolioUseCase).not.toHaveBeenCalled()
  })

  it('prints the version', async () => {
    const io = interceptExit()

    await expect(runApp('--version')).rejects.toThrow('process.exit(0)')

    expect(io.stdout()).toBe('0.1.0\n')
  })

  it('lists every command in the help', async () => {
    const io = interceptExit()

    await expect(runApp('--help')).rejects.toThrow('process.exit(0)')

    const help = io.stdout()
    expect(help).toContain('Usage: portfolio [options] [command]')
    expect(help).toContain('CLI tool to help you calculate shares in your portfolio')
    for (const command of ['show', 'minimal', 'target', 'rebalance', 'invest']) {
      expect(help).toMatch(new RegExp(`^ {2}${command}\\b`, 'm'))
    }
    expect(Object.values(mocks).filter((mock) => mock.mock.calls.length > 0)).toEqual([])
  })

  it('shows the help on stderr and exits with an error when no command is given', async () => {
    const io = interceptExit()

    await expect(runApp()).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toContain('Usage: portfolio [options] [command]')
  })

  it('exits with an error for an unknown command', async () => {
    const io = interceptExit()

    await expect(runApp('sell')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toContain('unknown command \'sell\'')
  })

  it('exits with an error when a required argument is missing', async () => {
    const io = interceptExit()

    await expect(runApp('target')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toContain('missing required argument \'price\'')
    expect(mocks.GetPortfolioWithPriceUseCase).not.toHaveBeenCalled()
  })
})
