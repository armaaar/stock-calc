import { Command } from '@commander-js/extra-typings'
import { DEFAULT_ACCEPTABLE_PERCESION, DEFAULT_SHARES_STEP, GetPortfolioWithMinimumSharesUseCase } from '@/UseCases/GetPortfolioWithMinimumShares.UseCase'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'

export const minimalCli = new Command()

minimalCli.name('minimal')
  .description('Calculates the minimum number of shares you need to buy to satisfy your portfolio')
  .option('-p, --percision <percision>', 'how much can your securities percentage deviate from target', String(DEFAULT_ACCEPTABLE_PERCESION))
  .option('-s, --shares-step <step>', 'the minimum amount of shares a security is incremented by', String(DEFAULT_SHARES_STEP))
  .action(async ({ percision, sharesStep }) => {
    try {
      const useCase = new GetPortfolioWithMinimumSharesUseCase(
        Number(percision),
        Number(sharesStep),
      )
      const portfolio = await useCase.handler()
      PortfolioCliPresenter.present(portfolio)
    } catch (e: unknown) {
      ErrorCliPresenter.present(e)
    }
  })
