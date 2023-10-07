import { Command } from '@commander-js/extra-typings'
import { GetCurrentPortfolioUseCase } from '@/UseCases/GetCurrentPortfolio.UseCase'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { protfolioOption } from '../cliOptions'

export const showCli = new Command()

showCli.name('show')
  .description('Show information about the current portfolio')
  .addOption(protfolioOption)
  .action(async ({ portfolio: portfolioType }) => {
    try {
      const useCase = new GetCurrentPortfolioUseCase(portfolioType)
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
