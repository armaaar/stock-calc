import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio, QDVE, SPYD } from '@/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '@/__fixtures__/console'
import { PortfolioCliPresenter, PresentMode } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { investCli } from '.././invest.CliCommand'

const { UseCase, handler } = vi.hoisted(() => {
  const handler = vi.fn()
  const UseCase = vi.fn(function GetPortfolioWithInvestmentUseCase() {
    return { handler }
  })
  return { UseCase, handler }
})

vi.mock('@/UseCases/GetPortfolioWithInvestment.UseCase', () => ({
  GetPortfolioWithInvestmentUseCase: UseCase,
}))

describe('invest command', () => {
  let spies: ConsoleSpies

  beforeEach(() => {
    vi.clearAllMocks()
    spies = spyOnConsole()
    // The example portfolio after `invest 1000`: buy 41 QDVE, sell 3 SPYD.
    handler.mockResolvedValue(buildPortfolio([
      { ...QDVE, shares: 141, initialShares: 100 },
      { ...SPYD, shares: 97, initialShares: 100 },
    ]))
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

    expect(UseCase).toHaveBeenCalledTimes(1)
    expect(UseCase).toHaveBeenCalledWith('EUR', 1000)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(present).toHaveBeenCalledWith(
      await handler.mock.results[0].value,
      PresentMode.WITH_DELTA,
    )
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: 980.15 EUR',
      'Portfolio Price: 10035.15 EUR',
      '',
    ])
    expect(spies.error).not.toHaveBeenCalled()
  })

  it.each([
    ['--pt', 'EGP'],
    ['--portfolio', 'EGP'],
  ])('uses the portfolio type given with %s', async (flag, type) => {
    await investCli.parseAsync(['250.5', flag, type], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith(type, 250.5)
  })

  it('accepts the option before the argument', async () => {
    await investCli.parseAsync(['--pt', 'EGP', '500'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('EGP', 500)
  })

  it('passes NaN for a non-numeric investment', async () => {
    // Current behaviour: the CLI does not validate the amount; Number('abc') is NaN.
    await investCli.parseAsync(['abc'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('EUR', NaN)
  })

  it('accepts a negative amount as the investment', async () => {
    // Current behaviour: commander 15 parses '-100' as a negative number argument (not as an
    // unknown option, as docs/domain/use-cases.md still says) and the CLI does not reject it.
    await investCli.parseAsync(['-100'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('EUR', -100)
  })

  it('routes a failing handler to the error presenter', async () => {
    const error = new Error('price not found')
    handler.mockRejectedValueOnce(error)
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await investCli.parseAsync(['1000'], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith(error)
    expect(present).not.toHaveBeenCalled()
    expect(printedLines(spies.error)).toEqual(['Error: price not found'])
  })
})
