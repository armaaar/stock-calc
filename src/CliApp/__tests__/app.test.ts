import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio } from '@/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '@/__fixtures__/console'

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

vi.mock('@/UseCases/GetCurrentPortfolio.UseCase', () => ({
  GetCurrentPortfolioUseCase: mocks.GetCurrentPortfolioUseCase,
}))
vi.mock('@/UseCases/GetRebalancedPortfolio.UseCase', () => ({
  GetRebalancedPortfolioUseCase: mocks.GetRebalancedPortfolioUseCase,
}))
vi.mock('@/UseCases/GetPortfolioWithInvestment.UseCase', () => ({
  GetPortfolioWithInvestmentUseCase: mocks.GetPortfolioWithInvestmentUseCase,
}))
vi.mock('@/UseCases/GetPortfolioWithPrice.UseCase', () => ({
  GetPortfolioWithPriceUseCase: mocks.GetPortfolioWithPriceUseCase,
}))
vi.mock('@/UseCases/GetPortfolioWithMinimumShares.UseCase', () => ({
  DEFAULT_ACCEPTABLE_PRECESION: 0.01,
  DEFAULT_SHARES_STEP: 1,
  GetPortfolioWithMinimumSharesUseCase: mocks.GetPortfolioWithMinimumSharesUseCase,
}))

const originalArgv = process.argv

/** Runs src/CliApp/app.ts as if invoked with `tsx src/CliApp/app.ts ...args`. */
async function runApp(...args: string[]) {
  process.argv = ['node', 'src/CliApp/app.ts', ...args]
  vi.resetModules()
  await import('@/CliApp/app')
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
  })

  it.each([
    [['show'], mocks.GetCurrentPortfolioUseCase, ['EUR']],
    [['rebalance', '--pt', 'EGP'], mocks.GetRebalancedPortfolioUseCase, ['EGP']],
    [['invest', '1000'], mocks.GetPortfolioWithInvestmentUseCase, ['EUR', 1000]],
    [['target', '5000', '--portfolio', 'EGP'], mocks.GetPortfolioWithPriceUseCase, ['EGP', 5000]],
    [['minimal', '-p', '0.001'], mocks.GetPortfolioWithMinimumSharesUseCase, ['EUR', 0.001, 1]],
  ])('dispatches %j to its use case', async (args, UseCase, expected) => {
    await runApp(...args)

    // cli.parse() does not await the async action, so wait for it to finish.
    await vi.waitFor(() => expect(spies.log).toHaveBeenCalled())
    expect(UseCase).toHaveBeenCalledTimes(1)
    expect(UseCase).toHaveBeenCalledWith(...expected)
    expect(mocks.handler).toHaveBeenCalledTimes(1)
    expect(printedLines(spies.log)).toContain('Portfolio Price: 9055 EUR')
  })

  it('passes a negative investment through as a number', async () => {
    // Current behaviour: `invest -100` is accepted (docs/domain/use-cases.md says it fails
    // with "unknown option '-100'", which no longer holds with commander 15).
    await runApp('invest', '-100')

    await vi.waitFor(() => expect(spies.log).toHaveBeenCalled())
    expect(mocks.GetPortfolioWithInvestmentUseCase).toHaveBeenCalledWith('EUR', -100)
  })

  it('presents errors from the use case without exiting', async () => {
    const io = interceptExit()
    mocks.handler.mockRejectedValueOnce(new Error('Settings file not found'))

    await runApp('show')

    await vi.waitFor(() => expect(spies.error).toHaveBeenCalled())
    expect(printedLines(spies.error)).toEqual(['Error: Settings file not found'])
    expect(io.exit).not.toHaveBeenCalled()
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
