import type { Portfolio } from '#src/Entities/Portfolio.Entity'

/** What the use cases need from storage: implemented by `Repositories/Portfolio.Repository`. */
export interface IPortfolioRepository {
  getPortfolio(type: string): Promise<Portfolio>
}
