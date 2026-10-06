import { Command } from '@commander-js/extra-typings'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { PortfolioCliPresenter, PresentMode } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { parseFiniteNumber, portfolioOption } from '../cliOptions'

export function createTargetCli(target: PortfolioUseCases['target']) {
  return new Command()
    .name('target')
    .description('Calculates the number of shares you need to buy to satisfy your portfolio with a limited budget')
    .argument('<price>', 'target portfolio price', parseFiniteNumber)
    .addOption(portfolioOption)
    .action(async (targetPrice, { portfolio: portfolioId }) => {
      try {
        const portfolio = await target.execute({ portfolio: portfolioId, targetPrice })
        PortfolioCliPresenter.present(portfolio, PresentMode.WITH_DELTA)
      } catch (e: unknown) {
        ErrorCliPresenter.present(e)
        process.exitCode = 1
      }
    })
}
