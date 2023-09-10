import { GetCurrentPortfolio_UseCase } from '@/UseCases/GetCurrentPortfolio.UseCase';
import { Command } from 'commander';
import { PortfolioCli_Presenter } from '../Presenters/PortfolioCli.Presenter';

export const getPortfolioCli = new Command();

getPortfolioCli.name('get-portfolio')
    .description('Show information about the current portfolio')
    .action(async () => {
        const useCase = new GetCurrentPortfolio_UseCase()
        const portfolio = await useCase.handler()
        PortfolioCli_Presenter.present(portfolio)
    });