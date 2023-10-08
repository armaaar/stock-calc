import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export class GetRebalancedPortfolioUseCase extends PortfolioUserCase {
  public async handler() {
    const portfolio = await this.getSourcePortfolio()

    portfolio.balanceForPrice(portfolio.totalPrice)

    return portfolio
  }
}
