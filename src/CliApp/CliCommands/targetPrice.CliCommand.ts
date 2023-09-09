import { GetPortfolioWithPrice_UseCase } from '@/UseCases/GetPortfolioWithPrice.UseCase';
import { Command } from 'commander';
import { PortfolioCli_Presenter } from '../Presenters/PortfolioCli.Presenter';

export const targetPriceCli = new Command();

targetPriceCli.name('target-price')
    .description('Calculates the number of shares you need to buy to satisfy your portfolio with a limited budget')
    .argument('<price>', 'target portfolio price')
    .action(async (targetPrice) => {
        const useCase = new GetPortfolioWithPrice_UseCase(Number(targetPrice))
        const portfolio = await useCase.handler()
        PortfolioCli_Presenter.present(portfolio)
    });