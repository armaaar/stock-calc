import { Command } from 'commander';
import { DEFAULT_ACCEPTABLE_PERCESION, DEFAULT_SHARES_STEP, GetPortfolioWithMinimumSharesUseCase } from '@/UseCases/GetPortfolioWithMinimumShares.UseCase';
import { PortfolioCliPresenter } from '../Presenters/PortfolioCli.Presenter';

export const minimumSharesCli = new Command();

interface MinimumSharesCliOptions {
  percision: string
  sharesStep: string
}

minimumSharesCli.name('minimum-shares')
  .description('Calculates the minimum number of shares you need to buy to satisfy your portfolio')
  .option('-p, --percision <percision>', 'how much can your securities percentage deviate from target', String(DEFAULT_ACCEPTABLE_PERCESION))
  .option('-s, --shares-step <step>', 'the minimum amount of shares a security is incremented by', String(DEFAULT_SHARES_STEP))
  .action(async ({ percision, sharesStep }: MinimumSharesCliOptions) => {
    const useCase = new GetPortfolioWithMinimumSharesUseCase(Number(percision), Number(sharesStep));
    const portfolio = await useCase.handler();
    PortfolioCliPresenter.present(portfolio);
  });
