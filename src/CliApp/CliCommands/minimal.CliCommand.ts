import { Command } from '@commander-js/extra-typings'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { DEFAULT_ACCEPTABLE_PRECISION, DEFAULT_SHARES_STEP } from '#src/UseCases/GetPortfolioWithMinimumShares.UseCase'
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter'
import { ErrorCliPresenter } from '../Presenters/ErrorCliPresenter.Presenter'
import { parseFiniteNumber, portfolioOption } from '../cliOptions'

export function createMinimalCli(minimal: PortfolioUseCases['minimal']) {
  return new Command()
    .name('minimal')
    .description('Calculates the minimum number of shares you need to buy to satisfy your portfolio')
    .option(
      '-p, --precision <precision>',
      'how much can your securities percentage deviate from target (> 0 and <= 1)',
      parseFiniteNumber,
      DEFAULT_ACCEPTABLE_PRECISION,
    )
    .option(
      '-s, --shares-step <step>',
      'the minimum amount of shares a security is incremented by (an integer >= 1)',
      parseFiniteNumber,
      DEFAULT_SHARES_STEP,
    )
    .addOption(portfolioOption)
    .action(async ({ precision, sharesStep, portfolio: portfolioId }) => {
      try {
        const portfolio = await minimal.execute({
          portfolio: portfolioId,
          acceptablePrecision: precision,
          sharesStep,
        })
        PortfolioCliPresenter.present(portfolio)
      } catch (e: unknown) {
        ErrorCliPresenter.present(e)
        process.exitCode = 1
      }
    })
}
