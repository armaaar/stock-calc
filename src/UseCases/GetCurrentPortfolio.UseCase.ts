import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export class GetCurrentPortfolioUseCase extends PortfolioUserCase {
  public async handler() {
    return this.getSourcePortfolio()
  }
}
