import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import { PortfolioCliPresenter, PresentMode } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { rebalanceCli } from '../rebalance.CliCommand'

const { UseCase, handler } = vi.hoisted(() => {
  const handler = vi.fn()
  const UseCase = vi.fn(function GetRebalancedPortfolioUseCase() {
    return { handler }
  })
  return { UseCase, handler }
})

vi.mock('#src/UseCases/GetRebalancedPortfolio.UseCase', () => ({
  GetRebalancedPortfolioUseCase: UseCase,
}))

describe('rebalance command', () => {
  let spies: ConsoleSpies

  beforeEach(() => {
    vi.clearAllMocks()
    spies = spyOnConsole()
    const portfolio = buildPortfolio()
    portfolio.balanceForPrice(portfolio.totalPrice)
    handler.mockResolvedValue(portfolio)
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it('is named "rebalance" and takes the portfolio option', () => {
    expect(rebalanceCli.name()).toBe('rebalance')
    expect(rebalanceCli.description()).toBe('Rebalance the current portfolio')
    expect(rebalanceCli.registeredArguments).toHaveLength(0)
    expect(rebalanceCli.options.map((option) => option.long)).toEqual(['--portfolio'])
  })

  it('rebalances the EUR portfolio by default and presents it with the trades', async () => {
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await rebalanceCli.parseAsync([], { from: 'user' })

    expect(UseCase).toHaveBeenCalledTimes(1)
    expect(UseCase).toHaveBeenCalledWith('EUR')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(present).toHaveBeenCalledWith(
      await handler.mock.results[0].value,
      PresentMode.WITH_DELTA,
    )
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: -39.15 EUR',
      'Portfolio Price: 9015.85 EUR',
      '',
    ])
    expect(spies.error).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it.each([
    ['--pt', 'EGP'],
    ['--portfolio', 'EGP'],
  ])('uses the portfolio type given with %s', async (flag, type) => {
    await rebalanceCli.parseAsync([flag, type], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith(type)
  })

  it('routes a failing handler to the error presenter and sets exit code 1', async () => {
    const error = new AggregateError([new Error('JustEtf failed'), new Error('TradingView failed')])
    handler.mockRejectedValueOnce(error)
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await rebalanceCli.parseAsync([], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith(error)
    expect(present).not.toHaveBeenCalled()
    expect(printedLines(spies.error)).toEqual(['Error: JustEtf failed', 'Error: TradingView failed'])
    expect(process.exitCode).toBe(1)
  })
})
