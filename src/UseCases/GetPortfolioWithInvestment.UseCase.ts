import Decimal from 'decimal.js'
import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export class GetPortfolioWithInvestmentUseCase extends PortfolioUserCase {
  private investment: Decimal

  constructor(portfolioType: string, investment: number) {
    super(portfolioType)
    this.investment = new Decimal(investment)
  }

  public async handler() {
    const portfolio = await this.getSourcePortfolio()

    const newTargetPrice = portfolio.totalPrice.add(this.investment)
    portfolio.balanceForPrice(newTargetPrice)

    return portfolio
  }
}
