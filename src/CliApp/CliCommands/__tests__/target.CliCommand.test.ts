import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '@/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '@/__fixtures__/console'
import { PortfolioCliPresenter, PresentMode } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { targetCli } from '.././target.CliCommand'

const { UseCase, handler } = vi.hoisted(() => {
  const handler = vi.fn()
  const UseCase = vi.fn(function GetPortfolioWithPriceUseCase() {
    return { handler }
  })
  return { UseCase, handler }
})

vi.mock('@/UseCases/GetPortfolioWithPrice.UseCase', () => ({
  GetPortfolioWithPriceUseCase: UseCase,
}))

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
  })

  it.each([
    ['--pt', 'EGP'],
    ['--portfolio', 'EGP'],
  ])('uses the portfolio type given with %s', async (flag, type) => {
    await targetCli.parseAsync(['1e4', flag, type], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith(type, 10000)
  })

  it('passes NaN for a non-numeric price', async () => {
    // Current behaviour: `target abc` is not rejected; the use case receives NaN.
    await targetCli.parseAsync(['abc'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('EUR', NaN)
  })

  it('routes a failing handler to the error presenter', async () => {
    handler.mockRejectedValueOnce('not an error')
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await targetCli.parseAsync(['5000'], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith('not an error')
    expect(present).not.toHaveBeenCalled()
    expect(printedLines(spies.error)).toEqual(['not an error'])
  })
})
