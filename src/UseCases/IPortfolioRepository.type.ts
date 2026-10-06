import type { Portfolio } from '#src/Entities/Portfolio.Entity'

/** What the use cases need from storage: implemented by `Repositories/Portfolio.Repository`. */
export interface IPortfolioRepository {
  /** Loads the portfolio with this id (`<broker>/<portfolio>`), or the only one there is. */
  getPortfolio(portfolioId?: string): Promise<Portfolio>
}
