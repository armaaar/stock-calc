import { IsNumber } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PortfolioRequest, PortfolioUseCase } from './PortfolioUseCase.abstract'

export interface InvestmentRequest extends PortfolioRequest {
  /** Added to the portfolio value; negative to withdraw. */
  investment: number
}

/** A validated investment amount: any finite number. */
export class Investment {
  @IsNumber()
  public readonly amount: number

  constructor(amount: number) {
    this.amount = amount

    validateClassErrors(this, Investment)
  }
}

export class GetPortfolioWithInvestmentUseCase extends PortfolioUseCase<InvestmentRequest> {
  public async execute({ portfolioType, investment }: InvestmentRequest) {
    const amount = new Decimal(new Investment(investment).amount)
    const portfolio = await this.portfolioRepo.getPortfolio(portfolioType)

    portfolio.allocateCash(amount)

    return portfolio
  }
}
