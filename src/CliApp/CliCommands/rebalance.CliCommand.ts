import { Command } from '@commander-js/extra-typings'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { PortfolioCliPresenter, PresentMode } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { portfolioOption } from '../cliOptions'

export function createRebalanceCli(rebalance: PortfolioUseCases['rebalance']) {
  return new Command()
    .name('rebalance')
    .description('Rebalance the current portfolio')
    .addOption(portfolioOption)
    .action(async ({ portfolio: portfolioId }) => {
      try {
        const portfolio = await rebalance.execute({ portfolio: portfolioId })
        PortfolioCliPresenter.present(portfolio, PresentMode.WITH_DELTA)
      } catch (e: unknown) {
        ErrorCliPresenter.present(e)
        process.exitCode = 1
      }
    })
}
