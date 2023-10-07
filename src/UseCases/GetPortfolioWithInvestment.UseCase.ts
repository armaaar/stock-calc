import Decimal from 'decimal.js'
import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export class GetPortfolioWithInvestmentUseCase extends PortfolioUserCase {
  private investment: Decimal

  constructor(portfolioType: string, investment: number) {
    super(portfolioType)
    this.investment = new Decimal(investment)
  }

  public async handler() {
    const originalPortfolio = await this.getSourcePortfolio()
    const deltaPortfolio = originalPortfolio.clone()

    const newPortfolio = originalPortfolio.clone()
    const newTargetPrice = newPortfolio.totalPrice.add(this.investment)

    for (let i = 0; i < originalPortfolio.securities.length; i++) {
      // Update new portfolio
      const newSec = newPortfolio.securities[i]
      const secTargetPrice = newTargetPrice.times(newSec.targetPercentage)
      newSec.shares = secTargetPrice.dividedBy(newSec.price).round().toNumber()

      // Calculate delta portfolio
      const originalSec = originalPortfolio.securities[i]
      const deltaSec = deltaPortfolio.securities[i]
      deltaSec.shares = newSec.shares - originalSec.shares
    }

    return {
      originalPortfolio,
      deltaPortfolio,
      newPortfolio,
    }
  }
}
