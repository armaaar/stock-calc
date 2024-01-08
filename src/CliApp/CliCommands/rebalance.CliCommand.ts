import { Command } from '@commander-js/extra-typings'
import { PortfolioCliPresenter, PresentMode } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { GetRebalancedPortfolioUseCase } from '@/UseCases/GetRebalancedPortfolio.UseCase'
import { portfolioOption } from '../cliOptions'

export const rebalanceCli = new Command()

rebalanceCli.name('rebalance')
  .description('Rebalance the current portfolio')
  .addOption(portfolioOption)
  .action(async ({ portfolio: portfolioType }) => {
    try {
      const useCase = new GetRebalancedPortfolioUseCase(portfolioType)
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio, PresentMode.WITH_DELTA)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
