import { PortfolioRequest, PortfolioUseCase } from './PortfolioUseCase.abstract'

export class GetRebalancedPortfolioUseCase extends PortfolioUseCase {
  public async execute({ portfolioType }: PortfolioRequest) {
    const portfolio = await this.portfolioRepo.getPortfolio(portfolioType)

    portfolio.balanceForPrice(portfolio.totalPrice)

    return portfolio
  }
}
