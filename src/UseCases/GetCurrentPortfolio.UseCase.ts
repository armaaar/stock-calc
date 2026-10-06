import { PortfolioRequest, PortfolioUseCase } from './PortfolioUseCase.abstract'

export class GetCurrentPortfolioUseCase extends PortfolioUseCase {
  public async execute({ portfolioType }: PortfolioRequest) {
    return this.portfolioRepo.getPortfolio(portfolioType)
  }
}
