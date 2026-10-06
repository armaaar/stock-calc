import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import { StubUseCases, stubUseCases } from '#src/__fixtures__/useCases'
import { PortfolioCliPresenter, PresentMode } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { createShowCli } from '../show.CliCommand'

describe('show command', () => {
  let spies: ConsoleSpies
  let show: StubUseCases['show']
  let showCli: ReturnType<typeof createShowCli>

  beforeEach(() => {
    spies = spyOnConsole()
    show = stubUseCases().show
    show.execute.mockResolvedValue(buildPortfolio())
    showCli = createShowCli(show)
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it('is named "show" and takes the portfolio option', () => {
    expect(showCli.name()).toBe('show')
    expect(showCli.description()).toBe('Show information about the current portfolio')
    expect(showCli.registeredArguments).toHaveLength(0)
    expect(showCli.options.map((option) => option.long)).toEqual(['--portfolio'])
  })

  it('loads the EUR portfolio by default and presents the initial holdings', async () => {
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await showCli.parseAsync([], { from: 'user' })

    expect(show.execute).toHaveBeenCalledTimes(1)
    expect(show.execute).toHaveBeenCalledWith({})
    expect(present).toHaveBeenCalledWith(
      await show.execute.mock.results[0].value,
      PresentMode.ONLY_INITIAL,
    )
    expect(printedLines(spies.log)).toContain('Portfolio Price: 9055 EUR')
    expect(spies.error).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it.each([
    ['--pt', 'thndr/egp'],
    ['--portfolio', 'thndr/egp'],
  ])('uses the portfolio type given with %s', async (flag, type) => {
    await showCli.parseAsync([flag, type], { from: 'user' })

    expect(show.execute).toHaveBeenCalledWith({ portfolio: type })
  })

  it('accepts the --portfolio=<type> form', async () => {
    await showCli.parseAsync(['--portfolio=example/eur'], { from: 'user' })

    expect(show.execute).toHaveBeenCalledWith({ portfolio: 'example/eur' })
  })

  it('falls back to the default again on the next parse', async () => {
    await showCli.parseAsync(['--pt', 'thndr/egp'], { from: 'user' })
    await showCli.parseAsync([], { from: 'user' })

    expect(show.execute.mock.calls).toEqual([
      [{ portfolio: 'thndr/egp' }],
      [{}],
    ])
  })

  it('routes a failing use case to the error presenter and sets exit code 1', async () => {
    const error = new Error('Settings file not found')
    show.execute.mockRejectedValueOnce(error)
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await expect(showCli.parseAsync([], { from: 'user' })).resolves.toBe(showCli)

    expect(presentError).toHaveBeenCalledWith(error)
    expect(present).not.toHaveBeenCalled()
    expect(printedLines(spies.error)).toEqual(['Error: Settings file not found'])
    expect(process.exitCode).toBe(1)
  })

  it('routes a use case that throws synchronously to the error presenter', async () => {
    show.execute.mockImplementationOnce(() => {
      throw new Error('bad type')
    })
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await showCli.parseAsync([], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith(new Error('bad type'))
    expect(present).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })
})
