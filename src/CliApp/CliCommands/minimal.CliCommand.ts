import { Command } from '@commander-js/extra-typings'
import { DEFAULT_ACCEPTABLE_PRECESION, DEFAULT_SHARES_STEP, GetPortfolioWithMinimumSharesUseCase } from '@/UseCases/GetPortfolioWithMinimumShares.UseCase'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { portfolioOption } from '../cliOptions'

export const minimalCli = new Command()

minimalCli.name('minimal')
  .description('Calculates the minimum number of shares you need to buy to satisfy your portfolio')
  .option('-p, --precision <precision>', 'how much can your securities percentage deviate from target', String(DEFAULT_ACCEPTABLE_PRECESION))
  .option('-s, --shares-step <step>', 'the minimum amount of shares a security is incremented by', String(DEFAULT_SHARES_STEP))
  .addOption(portfolioOption)
  .action(async ({ precision, sharesStep, portfolio: portfolioType }) => {
    try {
      const useCase = new GetPortfolioWithMinimumSharesUseCase(
        portfolioType,
        Number(precision),
        Number(sharesStep),
      )
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
