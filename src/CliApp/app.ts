import { DEFAULT_ACCEPTABLE_PERCESION, GetPortfolioWithMinimumShares } from '@/UseCases/GetPortfolioWithMinimumShares.UseCase';
import { Command } from 'commander';
import { PortfolioCli_Presenter } from './Presenters/PortfolioCli.Presenter';

const program = new Command();

program
    .name('portfolio-helper')
    .description('CLI to help you calculate shares in your portfolio')
    .version('0.1.0');

program.command('minimum-shares')
    .description('Calculates the minimum number of shares you need to buy to satisfy your portfolio')
    .option('-p, --percision <percision>', 'how much can your securities percentage deviate from target', String(DEFAULT_ACCEPTABLE_PERCESION))
    .action(async (options) => {
        const useCase = new GetPortfolioWithMinimumShares(Number(options.percision))
        const portfolio = await useCase.handler()
        PortfolioCli_Presenter.present(portfolio)
    });


program.parse();