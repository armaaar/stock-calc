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

    for (let i = 0; i < portfolio.securities.length; i++) {
      const sec = portfolio.securities[i]
      const secTargetPrice = this.targetPrice.times(sec.targetPercentage)
      sec.shares = secTargetPrice.dividedBy(sec.price).round().toNumber()
    }

    return portfolio
  }
}
