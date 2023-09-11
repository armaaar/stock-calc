import { PortfolioRepository } from '@/Repositories/Portfolio.Repository'

export class GetRebalancedPortfolioUseCase {
  private portfolioRepo = new PortfolioRepository()

  public async handler() {
    const portfolio = await this.portfolioRepo.getPortfolio()
    const targetPrice = portfolio.totalPrice

    for (let i = 0; i < portfolio.securities.length; i++) {
      const sec = portfolio.securities[i]
      const secTargetPrice = targetPrice.times(sec.targetPercentage)
      sec.shares = secTargetPrice.dividedBy(sec.price).round().toNumber()
    }

    return portfolio
  }
}
