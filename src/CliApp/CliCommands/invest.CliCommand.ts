import { Command } from '@commander-js/extra-typings'
import { PortfolioCliPresenter, PresentMode } from '../Presenters/PortfolioCli.Presenter'
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
      const portfolio = await useCase.handler()

      PortfolioCliPresenter.present(portfolio, PresentMode.WITH_DELTA)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
