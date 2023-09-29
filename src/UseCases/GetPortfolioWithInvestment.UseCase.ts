import Decimal from 'decimal.js'
import { PortfolioRepository } from '@/Repositories/Portfolio.Repository'

export class GetPortfolioWithInvestmentUseCase {
  private investment: Decimal

  private portfolioRepo = new PortfolioRepository()

  constructor(investment: number) {
    this.investment = new Decimal(investment)
  }

  public async handler() {
    const originalPortfolio = await this.portfolioRepo.getPortfolio()
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
