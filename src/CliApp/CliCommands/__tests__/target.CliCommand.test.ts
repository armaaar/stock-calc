import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '#src/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import { PortfolioCliPresenter, PresentMode } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { targetCli } from '../target.CliCommand'

const { UseCase, handler } = vi.hoisted(() => {
  const handler = vi.fn()
  const UseCase = vi.fn(function GetPortfolioWithPriceUseCase() {
    return { handler }
  })
  return { UseCase, handler }
})

vi.mock('#src/UseCases/GetPortfolioWithPrice.UseCase', () => ({
  GetPortfolioWithPriceUseCase: UseCase,
}))

/** Makes process.exit throw instead of exiting and captures what commander writes to stderr. */
function interceptExit() {
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  return () => stderr.mock.calls.map(([chunk]) => String(chunk)).join('')
}

describe('target command', () => {
  let spies: ConsoleSpies

  beforeEach(() => {
    vi.clearAllMocks()
    spies = spyOnConsole()
    // The example portfolio after `target 5000`: sell 30 QDVE and 52 SPYD.
    handler.mockResolvedValue(buildPortfolio([
      { ...QDVE, shares: 70, initialShares: 100 },
      { ...SPYD, shares: 48, initialShares: 100 },
    ]))
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it('is named "target" and takes a <price> argument and the portfolio option', () => {
    expect(targetCli.name()).toBe('target')
    expect(targetCli.description()).toBe(
      'Calculates the number of shares you need to buy to satisfy your portfolio with a limited budget',
    )
    expect(targetCli.registeredArguments.map((arg) => [arg.name(), arg.required])).toEqual([
      ['price', true],
    ])
    expect(targetCli.options.map((option) => option.long)).toEqual(['--portfolio'])
  })

  it('passes the target price as a number and presents the plan with the trades', async () => {
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await targetCli.parseAsync(['5000'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledTimes(1)
    expect(UseCase).toHaveBeenCalledWith('EUR', 5000)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(present).toHaveBeenCalledWith(
      await handler.mock.results[0].value,
      PresentMode.WITH_DELTA,
    )
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: -4082.7 EUR',
      'Portfolio Price: 4972.3 EUR',
      '',
    ])
    expect(spies.error).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it.each([
    ['--pt', 'EGP'],
    ['--portfolio', 'EGP'],
  ])('uses the portfolio type given with %s', async (flag, type) => {
    await targetCli.parseAsync(['1e4', flag, type], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith(type, 10000)
  })

  it.each(['abc', '12abc', 'NaN', 'Infinity'])(
    'rejects the non-numeric price %j with a usage error',
    async (value) => {
      const stderr = interceptExit()

      await expect(targetCli.parseAsync([value], { from: 'user' }))
        .rejects.toThrow('process.exit(1)')

      expect(stderr()).toBe(
        `error: command-argument value '${value}' is invalid for argument 'price'. `
        + 'Not a finite number.\n',
      )
      expect(UseCase).not.toHaveBeenCalled()
    },
  )

  it('leaves the range check (price > 0) to the use case', async () => {
    await targetCli.parseAsync(['-5'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('EUR', -5)
  })

  it('routes a failing handler to the error presenter and sets exit code 1', async () => {
    handler.mockRejectedValueOnce('not an error')
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await targetCli.parseAsync(['5000'], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith('not an error')
    expect(present).not.toHaveBeenCalled()
    expect(printedLines(spies.error)).toEqual(['not an error'])
    expect(process.exitCode).toBe(1)
  })
})
