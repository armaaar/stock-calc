import { IsNumber, IsPositive } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '@/Shared/ClassValidatorError'
import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export class GetPortfolioWithPriceUseCase extends PortfolioUserCase {
  private targetPrice: Decimal

  @IsNumber()
  @IsPositive()
  protected get targetPriceValue(): number {
    return this.targetPrice.toNumber()
  }

  constructor(portfolioType: string, targetPrice: number) {
    super(portfolioType)
    this.targetPrice = new Decimal(targetPrice)

    validateClassErrors(this, GetPortfolioWithPriceUseCase)
  }

  public async handler() {
    const portfolio = await this.getSourcePortfolio()

    portfolio.balanceForPrice(this.targetPrice)

    return portfolio
  }
}
