import { GetCurrentPortfolioUseCase } from './GetCurrentPortfolio.UseCase'
import { GetPortfolioWithInvestmentUseCase, InvestmentRequest } from './GetPortfolioWithInvestment.UseCase'
import { GetPortfolioWithMinimumSharesUseCase, MinimumSharesRequest } from './GetPortfolioWithMinimumShares.UseCase'
import { GetPortfolioWithPriceUseCase, TargetPriceRequest } from './GetPortfolioWithPrice.UseCase'
import { GetRebalancedPortfolioUseCase } from './GetRebalancedPortfolio.UseCase'
import { IPortfolioRepository } from './IPortfolioRepository.type'
import { IPortfolioUseCase } from './PortfolioUseCase.abstract'

/** Every operation, keyed by its CLI command / MCP tool name: what the interfaces depend on. */
export interface PortfolioUseCases {
  show: IPortfolioUseCase
  minimal: IPortfolioUseCase<MinimumSharesRequest>
  target: IPortfolioUseCase<TargetPriceRequest>
  rebalance: IPortfolioUseCase
  invest: IPortfolioUseCase<InvestmentRequest>
}

export function createPortfolioUseCases(portfolioRepo: IPortfolioRepository): PortfolioUseCases {
  return {
    show: new GetCurrentPortfolioUseCase(portfolioRepo),
    minimal: new GetPortfolioWithMinimumSharesUseCase(portfolioRepo),
    target: new GetPortfolioWithPriceUseCase(portfolioRepo),
    rebalance: new GetRebalancedPortfolioUseCase(portfolioRepo),
    invest: new GetPortfolioWithInvestmentUseCase(portfolioRepo),
  }
}
