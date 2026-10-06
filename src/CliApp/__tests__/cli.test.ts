import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import { StubUseCases, stubUseCases } from '#src/__fixtures__/useCases'
import { createCli } from '../cli'

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

describe('CLI program', () => {
  let spies: ConsoleSpies
  let useCases: StubUseCases

  /** Parses the arguments the way `tsx src/CliApp/app.ts ...args` would. */
  function run(...args: string[]) {
    return createCli(useCases).parseAsync(args, { from: 'user' })
  }

  function executeCalls() {
    return Object.values(useCases).flatMap(({ execute }) => execute.mock.calls)
  }

  beforeEach(() => {
    spies = spyOnConsole()
    useCases = stubUseCases()
    for (const { execute } of Object.values(useCases)) {
      execute.mockImplementation(async () => buildPortfolio())
    }
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it.each([
    [['show'], 'show', { portfolioType: 'EUR' }],
    [['rebalance', '--pt', 'EGP'], 'rebalance', { portfolioType: 'EGP' }],
    [['invest', '1000'], 'invest', { portfolioType: 'EUR', investment: 1000 }],
    [['target', '5000', '--portfolio', 'EGP'], 'target', { portfolioType: 'EGP', targetPrice: 5000 }],
    [['minimal', '-p', '0.001'], 'minimal', {
      portfolioType: 'EUR', acceptablePrecision: 0.001, sharesStep: 1,
    }],
  ] as const)('dispatches %j to its use case', async (args, name, request) => {
    await run(...args)

    expect(useCases[name].execute).toHaveBeenCalledTimes(1)
    expect(useCases[name].execute).toHaveBeenCalledWith(request)
    expect(executeCalls()).toHaveLength(1)
    expect(printedLines(spies.log)).toContain('Portfolio Price: 9055 EUR')
  })

  it('passes a negative investment through as a number', async () => {
    await run('invest', '-100')

    expect(useCases.invest.execute).toHaveBeenCalledWith({ portfolioType: 'EUR', investment: -100 })
  })

  it('presents errors from the use case and sets exit code 1 without exiting early', async () => {
    const io = interceptExit()
    useCases.show.execute.mockRejectedValueOnce(new Error('Settings file not found'))

    await run('show')

    expect(printedLines(spies.error)).toEqual(['Error: Settings file not found'])
    expect(process.exitCode).toBe(1)
    expect(io.exit).not.toHaveBeenCalled()
  })

  it('leaves the exit code unset when the command succeeds', async () => {
    await run('show')

    expect(process.exitCode).toBeUndefined()
  })

  it('exits with a usage error for a non-numeric argument', async () => {
    const io = interceptExit()

    await expect(run('target', 'abc')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toBe(
      'error: command-argument value \'abc\' is invalid for argument \'price\'. '
      + 'Not a finite number.\n',
    )
    expect(useCases.target.execute).not.toHaveBeenCalled()
  })

  it('exits with a usage error for a non-numeric option', async () => {
    const io = interceptExit()

    await expect(run('minimal', '--shares-step', 'two')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toBe(
      'error: option \'-s, --shares-step <step>\' argument \'two\' is invalid. '
      + 'Not a finite number.\n',
    )
    expect(useCases.minimal.execute).not.toHaveBeenCalled()
  })

  it('exits with a usage error for an invalid portfolio name', async () => {
    const io = interceptExit()

    await expect(run('show', '--pt', '../EUR')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toBe(
      'error: option \'--pt, --portfolio <type>\' argument \'../EUR\' is invalid. '
      + 'Use letters, digits, \'_\' or \'-\'.\n',
    )
    expect(useCases.show.execute).not.toHaveBeenCalled()
  })

  it('prints the version', async () => {
    const io = interceptExit()

    await expect(run('--version')).rejects.toThrow('process.exit(0)')

    expect(io.stdout()).toBe('0.1.0\n')
  })

  it('lists every command in the help', async () => {
    const io = interceptExit()

    await expect(run('--help')).rejects.toThrow('process.exit(0)')

    const help = io.stdout()
    expect(help).toContain('Usage: portfolio [options] [command]')
    expect(help).toContain('CLI tool to help you calculate shares in your portfolio')
    for (const command of ['show', 'minimal', 'target', 'rebalance', 'invest']) {
      expect(help).toMatch(new RegExp(`^ {2}${command}\\b`, 'm'))
    }
    expect(executeCalls()).toEqual([])
  })

  it('registers the commands in order', () => {
    expect(createCli(useCases).commands.map((command) => command.name()))
      .toEqual(['show', 'minimal', 'target', 'rebalance', 'invest'])
  })

  it('shows the help on stderr and exits with an error when no command is given', async () => {
    const io = interceptExit()

    await expect(run()).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toContain('Usage: portfolio [options] [command]')
  })

  it('exits with an error for an unknown command', async () => {
    const io = interceptExit()

    await expect(run('sell')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toContain('unknown command \'sell\'')
  })

  it('exits with an error when a required argument is missing', async () => {
    const io = interceptExit()

    await expect(run('target')).rejects.toThrow('process.exit(1)')

    expect(io.stderr()).toContain('missing required argument \'price\'')
    expect(useCases.target.execute).not.toHaveBeenCalled()
  })
})
