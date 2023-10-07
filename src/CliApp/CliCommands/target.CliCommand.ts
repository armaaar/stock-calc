import { Command } from '@commander-js/extra-typings'
import { GetPortfolioWithPriceUseCase } from '@/UseCases/GetPortfolioWithPrice.UseCase'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { protfolioOption } from '../cliOptions'

export const targetCli = new Command()

targetCli.name('target')
  .description('Calculates the number of shares you need to buy to satisfy your portfolio with a limited budget')
  .argument('<price>', 'target portfolio price')
  .addOption(protfolioOption)
  .action(async (targetPrice, { portfolio: portfolioType }) => {
    try {
      const useCase = new GetPortfolioWithPriceUseCase(portfolioType, Number(targetPrice))
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
