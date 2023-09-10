import { PortfolioRepository } from '@/Repositories/Portfolio.Repository'

export class GetCurrentPortfolioUseCase {
  private portfolioRepo = new PortfolioRepository()

  public async handler() {
    return this.portfolioRepo.getPortfolio()
  }
}
