import Decimal from 'decimal.js'
import { PortfolioRepository } from '@/Repositories/Portfolio.Repository'

export class GetPortfolioWithPriceUseCase {
  private targetPrice: Decimal

  private portfolioRepo = new PortfolioRepository()

  constructor(targetPrice: number) {
    this.targetPrice = new Decimal(targetPrice)
  }

  public async handler() {
    const portfolio = await this.portfolioRepo.getPortfolio()

    for (let i = 0; i < portfolio.securities.length; i++) {
      const sec = portfolio.securities[i]
      const secTargetPrice = this.targetPrice.times(sec.targetPercentage)
      sec.shares = secTargetPrice.dividedBy(sec.price).round().toNumber()
    }

    return portfolio
  }
}
