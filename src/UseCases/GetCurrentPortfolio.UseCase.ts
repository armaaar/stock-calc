import { PortfolioRequest, PortfolioUseCase } from './PortfolioUseCase.abstract'

export class GetCurrentPortfolioUseCase extends PortfolioUseCase {
  public async execute({ portfolio: portfolioId }: PortfolioRequest) {
    return this.portfolioRepo.getPortfolio(portfolioId)
  }
}
