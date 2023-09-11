import { Command } from '@commander-js/extra-typings'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { GetRebalancedPortfolioUseCase } from '@/UseCases/GetRebalancedPortfolio.UseCase'

export const rebalancePortfolioCli = new Command()

rebalancePortfolioCli.name('rebalance-portfolio')
  .description('Rebalance the current portfolio')
  .action(async () => {
    try {
      const useCase = new GetRebalancedPortfolioUseCase()
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
