import { Command } from 'commander'
import { GetCurrentPortfolioUseCase } from '@/UseCases/GetCurrentPortfolio.UseCase'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'

export const getPortfolioCli = new Command()

getPortfolioCli.name('get-portfolio')
  .description('Show information about the current portfolio')
  .action(async () => {
    try {
      const useCase = new GetCurrentPortfolioUseCase()
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
