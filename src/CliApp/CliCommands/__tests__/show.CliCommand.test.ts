import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPortfolio } from '@/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '@/__fixtures__/console'
import { PortfolioCliPresenter, PresentMode } from '../../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../../Presenters/ErrorCliPresenter.Presenter'
import { showCli } from '.././show.CliCommand'

const { UseCase, handler } = vi.hoisted(() => {
  const handler = vi.fn()
  const UseCase = vi.fn(function GetCurrentPortfolioUseCase() {
    return { handler }
  })
  return { UseCase, handler }
})

vi.mock('@/UseCases/GetCurrentPortfolio.UseCase', () => ({
  GetCurrentPortfolioUseCase: UseCase,
}))

describe('show command', () => {
  let spies: ConsoleSpies

  beforeEach(() => {
    vi.clearAllMocks()
    spies = spyOnConsole()
    handler.mockResolvedValue(buildPortfolio())
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

    expect(UseCase).toHaveBeenCalledTimes(1)
    expect(UseCase).toHaveBeenCalledWith('EUR')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(present).toHaveBeenCalledWith(
      await handler.mock.results[0].value,
      PresentMode.ONLY_INITIAL,
    )
    expect(printedLines(spies.log)).toContain('Portfolio Price: 9055 EUR')
    expect(spies.error).not.toHaveBeenCalled()
  })

  it.each([
    ['--pt', 'EGP'],
    ['--portfolio', 'EGP'],
  ])('uses the portfolio type given with %s', async (flag, type) => {
    await showCli.parseAsync([flag, type], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith(type)
  })

  it('accepts the --portfolio=<type> form', async () => {
    await showCli.parseAsync(['--portfolio=TMP'], { from: 'user' })

    expect(UseCase).toHaveBeenCalledWith('TMP')
  })

  it('falls back to the default again on the next parse', async () => {
    await showCli.parseAsync(['--pt', 'EGP'], { from: 'user' })
    await showCli.parseAsync([], { from: 'user' })

    expect(UseCase.mock.calls).toEqual([['EGP'], ['EUR']])
  })

  it('routes a failing handler to the error presenter', async () => {
    const error = new Error('Settings file not found')
    handler.mockRejectedValueOnce(error)
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')
    const present = vi.spyOn(PortfolioCliPresenter, 'present')

    await expect(showCli.parseAsync([], { from: 'user' })).resolves.toBe(showCli)

    expect(presentError).toHaveBeenCalledWith(error)
    expect(present).not.toHaveBeenCalled()
    expect(printedLines(spies.error)).toEqual(['Error: Settings file not found'])
  })

  it('routes a throwing use case constructor to the error presenter', async () => {
    UseCase.mockImplementationOnce(function GetCurrentPortfolioUseCase() {
      throw new Error('bad type')
    })
    const presentError = vi.spyOn(ErrorCliPresenter, 'present')

    await showCli.parseAsync([], { from: 'user' })

    expect(presentError).toHaveBeenCalledWith(new Error('bad type'))
    expect(handler).not.toHaveBeenCalled()
  })
})
