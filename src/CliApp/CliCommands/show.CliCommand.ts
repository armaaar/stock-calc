import { Command } from '@commander-js/extra-typings'
import { GetCurrentPortfolioUseCase } from '@/UseCases/GetCurrentPortfolio.UseCase'
import { PortfolioCliPresenter, PresentMode } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { portfolioOption } from '../cliOptions'

export const showCli = new Command()

showCli.name('show')
  .description('Show information about the current portfolio')
  .addOption(portfolioOption)
  .action(async ({ portfolio: portfolioType }) => {
    try {
      const useCase = new GetCurrentPortfolioUseCase(portfolioType)
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio, PresentMode.ONLY_INITIAL)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
