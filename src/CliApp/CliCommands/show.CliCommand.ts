import { Command } from '@commander-js/extra-typings'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { PortfolioCliPresenter, PresentMode } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { portfolioOption } from '../cliOptions'

export function createShowCli(show: PortfolioUseCases['show']) {
  return new Command()
    .name('show')
    .description('Show information about the current portfolio')
    .addOption(portfolioOption)
    .action(async ({ portfolio: portfolioId }) => {
      try {
        const portfolio = await show.execute({ portfolio: portfolioId })
        PortfolioCliPresenter.present(portfolio, PresentMode.ONLY_INITIAL)
      } catch (e: unknown) {
        ErrorCliPresenter.present(e)
        process.exitCode = 1
      }
    })
}
