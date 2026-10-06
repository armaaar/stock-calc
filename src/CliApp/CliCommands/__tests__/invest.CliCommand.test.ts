import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import { StubUseCases, stubUseCases } from '#src/__fixtures__/useCases'
import { PortfolioCliPresenter, PresentMode } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { createInvestCli } from '../invest.CliCommand'

/** Makes process.exit throw instead of exiting and captures what commander writes to stderr. */
function interceptExit() {
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  return () => stderr.mock.calls.map(([chunk]) => String(chunk)).join('')
}

describe('invest command', () => {
  let spies: ConsoleSpies
  let invest: StubUseCases['invest']
  let investCli: ReturnType<typeof createInvestCli>

  beforeEach(() => {
    spies = spyOnConsole()
    invest = stubUseCases().invest
    // The example portfolio after `invest 1000`: buy 41 QDVE, sell 3 SPYD.
    invest.execute.mockResolvedValue(buildPortfolio([
      { ...QDVE, shares: 141, initialShares: 100 },
      { ...SPYD, shares: 97, initialShares: 100 },
    ]))
    investCli = createInvestCli(invest)
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it('is named "invest" and takes an <investment> argument and the portfolio option', () => {
    expect(investCli.name()).toBe('invest')
    expect(investCli.description()).toBe(
      'Calculates the number of shares you need to buy to satisfy your portfolio if you invest additionally',
    )
    expect(investCli.registeredArguments.map((arg) => [arg.name(), arg.required])).toEqual([
      ['investment', true],
    ])
    expect(investCli.options.map((option) => option.long)).toEqual(['--portfolio'])
  })

  it('passes the investment as a number and presents the plan with the trades', async () => {
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await investCli.parseAsync(['1000'], { from: 'user' })

    expect(invest.execute).toHaveBeenCalledTimes(1)
    expect(invest.execute).toHaveBeenCalledWith({ portfolioType: 'EUR', investment: 1000 })
    expect(present).toHaveBeenCalledWith(
      await invest.execute.mock.results[0].value,
      PresentMode.WITH_DELTA,
    )
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: 980.15 EUR',
      'Portfolio Price: 10035.15 EUR',
      '',
    ])
    expect(spies.error).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it.each([
    ['--pt', 'EGP'],
    ['--portfolio', 'EGP'],
  ])('uses the portfolio type given with %s', async (flag, type) => {
    await investCli.parseAsync(['250.5', flag, type], { from: 'user' })

    expect(invest.execute).toHaveBeenCalledWith({ portfolioType: type, investment: 250.5 })
  })

  it('accepts the option before the argument', async () => {
    await investCli.parseAsync(['--pt', 'EGP', '500'], { from: 'user' })

    expect(invest.execute).toHaveBeenCalledWith({ portfolioType: 'EGP', investment: 500 })
  })

  it.each(['abc', 'Infinity', ''])(
    'rejects the non-numeric investment %j with a usage error',
    async (value) => {
      const stderr = interceptExit()

      await expect(investCli.parseAsync([value], { from: 'user' }))
        .rejects.toThrow('process.exit(1)')

      expect(stderr()).toBe(
        `error: command-argument value '${value}' is invalid for argument 'investment'. `
        + 'Not a finite number.\n',
      )
      expect(invest.execute).not.toHaveBeenCalled()
    },
  )

  it('rejects an invalid portfolio name with a usage error', async () => {
    const stderr = interceptExit()

    await expect(investCli.parseAsync(['1000', '--pt', 'EUR.old'], { from: 'user' }))
      .rejects.toThrow('process.exit(1)')

    expect(stderr()).toContain('argument \'EUR.old\' is invalid. Use letters, digits, \'_\' or \'-\'.')
    expect(invest.execute).not.toHaveBeenCalled()
  })

  it('accepts a negative amount as the investment, to plan a withdrawal', async () => {
    await investCli.parseAsync(['-100'], { from: 'user' })

    expect(invest.execute).toHaveBeenCalledWith({ portfolioType: 'EUR', investment: -100 })
  })

  it('routes a failing use case to the error presenter and sets exit code 1', async () => {
    const error = new Error('price not found')
    invest.execute.mockRejectedValueOnce(error)
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await investCli.parseAsync(['1000'], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith(error)
    expect(present).not.toHaveBeenCalled()
    expect(printedLines(spies.error)).toEqual(['Error: price not found'])
    expect(process.exitCode).toBe(1)
  })
})
