import Decimal from 'decimal.js'
import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export class GetPortfolioWithPriceUseCase extends PortfolioUserCase {
  private targetPrice: Decimal

  constructor(portfolioType: string, targetPrice: number) {
    super(portfolioType)
    this.targetPrice = new Decimal(targetPrice)
  }

  public async handler() {
    const portfolio = await this.getSourcePortfolio()

    portfolio.balanceForPrice(this.targetPrice)

    return portfolio
  }
}
