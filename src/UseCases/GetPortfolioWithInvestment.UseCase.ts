import { IsNumber } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export class GetPortfolioWithInvestmentUseCase extends PortfolioUserCase {
  private investment: Decimal

  @IsNumber()
  protected get investmentValue(): number {
    return this.investment.toNumber()
  }

  constructor(portfolioType: string, investment: number) {
    super(portfolioType)
    this.investment = new Decimal(investment)

    validateClassErrors(this, GetPortfolioWithInvestmentUseCase)
  }

  public async handler() {
    const portfolio = await this.getSourcePortfolio()

    const newTargetPrice = portfolio.totalPrice.add(this.investment)
    if (newTargetPrice.lessThan(0)) {
      throw Error(
        `Cannot withdraw ${this.investment.negated()}: more than the portfolio value (${portfolio.totalPrice})`,
      )
    }
    portfolio.balanceForPrice(newTargetPrice)

    return portfolio
  }
}
