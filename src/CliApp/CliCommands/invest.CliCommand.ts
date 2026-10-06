import { Command } from '@commander-js/extra-typings'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { PortfolioCliPresenter, PresentMode } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { parseFiniteNumber, portfolioOption } from '../cliOptions'

export function createInvestCli(invest: PortfolioUseCases['invest']) {
  return new Command()
    .name('invest')
    .description('Calculates the number of shares you need to buy to satisfy your portfolio if you invest additionally')
    .argument('<investment>', 'Additional investment (negative to withdraw)', parseFiniteNumber)
    .option('-b, --buy-only', 'only buy: never sell to rebalance (the investment must be at least 0)')
    .addOption(portfolioOption)
    .action(async (investment, { portfolio: portfolioType, buyOnly = false }) => {
      try {
        const portfolio = await invest.execute({ portfolioType, investment, buyOnly })
        PortfolioCliPresenter.present(portfolio, PresentMode.WITH_DELTA)
      } catch (e: unknown) {
        ErrorCliPresenter.present(e)
        process.exitCode = 1
      }
    })
}
