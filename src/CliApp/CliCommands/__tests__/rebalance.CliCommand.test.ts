import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import { StubUseCases, stubUseCases } from '#src/__fixtures__/useCases'
import { PortfolioCliPresenter, PresentMode } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { createRebalanceCli } from '../rebalance.CliCommand'

describe('rebalance command', () => {
  let spies: ConsoleSpies
  let rebalance: StubUseCases['rebalance']
  let rebalanceCli: ReturnType<typeof createRebalanceCli>

  beforeEach(() => {
    spies = spyOnConsole()
    rebalance = stubUseCases().rebalance
    const portfolio = buildPortfolio()
    portfolio.balanceForPrice(portfolio.totalPrice)
    rebalance.execute.mockResolvedValue(portfolio)
    rebalanceCli = createRebalanceCli(rebalance)
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

    expect(rebalance.execute).toHaveBeenCalledTimes(1)
    expect(rebalance.execute).toHaveBeenCalledWith({ portfolioType: 'EUR' })
    expect(present).toHaveBeenCalledWith(
      await rebalance.execute.mock.results[0].value,
      PresentMode.WITH_DELTA,
    )
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: -39.15 EUR',
      'Portfolio Price: 9015.85 EUR',
      'Cash After Trades: 37.15 EUR',
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

    expect(rebalance.execute).toHaveBeenCalledWith({ portfolioType: type })
  })

  it('routes a failing use case to the error presenter and sets exit code 1', async () => {
    const error = new AggregateError([new Error('JustEtf failed'), new Error('TradingView failed')])
    rebalance.execute.mockRejectedValueOnce(error)
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await rebalanceCli.parseAsync([], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith(error)
    expect(present).not.toHaveBeenCalled()
    expect(printedLines(spies.error)).toEqual(['Error: JustEtf failed', 'Error: TradingView failed'])
    expect(process.exitCode).toBe(1)
  })
})
