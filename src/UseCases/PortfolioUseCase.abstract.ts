import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { PortfolioRepository } from '#src/Repositories/Portfolio.Repository'

export abstract class PortfolioUserCase<R = unknown> {
  protected portfolioRepo = new PortfolioRepository()

  protected portfolioType: string

  constructor(portfolioType: string) {
    this.portfolioType = portfolioType
  }

  protected async getSourcePortfolio(): Promise<Portfolio> {
    return this.portfolioRepo.getPortfolio(this.portfolioType)
  }

  abstract handler(): R
}
