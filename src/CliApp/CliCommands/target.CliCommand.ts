import { Command } from '@commander-js/extra-typings'
import { GetPortfolioWithPriceUseCase } from '@/UseCases/GetPortfolioWithPrice.UseCase'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'

export const targetCli = new Command()

targetCli.name('target')
  .description('Calculates the number of shares you need to buy to satisfy your portfolio with a limited budget')
  .argument('<price>', 'target portfolio price')
  .action(async (targetPrice) => {
    try {
      const useCase = new GetPortfolioWithPriceUseCase(Number(targetPrice))
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })