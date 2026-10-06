import Decimal from 'decimal.js'
import { PortfolioRequest, PortfolioUseCase } from './PortfolioUseCase.abstract'

export class GetRebalancedPortfolioUseCase extends PortfolioUseCase {
  public async execute({ portfolio: portfolioId }: PortfolioRequest) {
    const portfolio = await this.portfolioRepo.getPortfolio(portfolioId)

    // Rebalancing is investing nothing new: only the holdings and the cash held are used
    portfolio.allocateCash(new Decimal(0))

    return portfolio
  }
}
