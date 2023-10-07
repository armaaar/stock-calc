import { Command } from '@commander-js/extra-typings'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { GetPortfolioWithInvestmentUseCase } from '@/UseCases/GetPortfolioWithInvestment.UseCase'
import { protfolioOption } from '../cliOptions'

export const investCli = new Command()

investCli.name('invest')
  .description('Calculates the number of shares you need to buy to satisfy your portfolio if you invest additionally')
  .argument('<investment>', 'Additional investment')
  .addOption(protfolioOption)
  .action(async (investment, { portfolio: portfolioType }) => {
    try {
      const useCase = new GetPortfolioWithInvestmentUseCase(portfolioType, Number(investment))
      const { originalPortfolio, deltaPortfolio, newPortfolio } = await useCase.handler()

      PortfolioCliPresenter.present(originalPortfolio, 'Original portfolio')
      PortfolioCliPresenter.present(deltaPortfolio, 'Changes to shares')
      PortfolioCliPresenter.present(newPortfolio, 'New portfolio')
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
