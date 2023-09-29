import { Command } from '@commander-js/extra-typings'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { GetPortfolioWithInvestmentUseCase } from '@/UseCases/GetPortfolioWithInvestment.UseCase'

export const investCli = new Command()

investCli.name('invest')
  .description('Calculates the number of shares you need to buy to satisfy your portfolio if you invest additionally')
  .argument('<investment>', 'Additional investment')
  .action(async (investment) => {
    try {
      const useCase = new GetPortfolioWithInvestmentUseCase(Number(investment))
      const { originalPortfolio, deltaPortfolio, newPortfolio } = await useCase.handler()

      PortfolioCliPresenter.present(originalPortfolio, 'Original portfolio')
      PortfolioCliPresenter.present(deltaPortfolio, 'Changes to shares')
      PortfolioCliPresenter.present(newPortfolio, 'New portfolio')
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
