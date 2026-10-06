import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { IPortfolioRepository } from './IPortfolioRepository.type'

/** Every request may name the portfolio to load; without one, the only portfolio is used. */
export interface PortfolioRequest {
  /** `<broker>/<portfolio>`, e.g. `ibkr/eur`. */
  portfolio?: string
}

/** What the interfaces call: one operation on a portfolio, returning the planned portfolio. */
export interface IPortfolioUseCase<Request extends PortfolioRequest = PortfolioRequest> {
  execute(request: Request): Promise<Portfolio>
}

export abstract class PortfolioUseCase<Request extends PortfolioRequest = PortfolioRequest>
implements IPortfolioUseCase<Request> {
  constructor(protected readonly portfolioRepo: IPortfolioRepository) {}

  abstract execute(request: Request): Promise<Portfolio>
}
