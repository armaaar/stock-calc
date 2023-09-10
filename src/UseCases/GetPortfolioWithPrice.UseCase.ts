import { PortfolioRepository } from '@/Repositories/Portfolio.Repository'

export class GetPortfolioWithPriceUseCase {
  private targetPrice: number

  private portfolioRepo = new PortfolioRepository()

  constructor(targetPrice: number) {
    this.targetPrice = targetPrice
  }

  public async handler() {
    const portfolio = await this.portfolioRepo.getPortfolio()

    for (let i = 0; i < portfolio.securities.length; i++) {
      const sec = portfolio.securities[i]
      const secTargetPrice = this.targetPrice * sec.targetPercentage
      sec.shares = Math.round(secTargetPrice / sec.price)
    }

    return portfolio
  }
}
