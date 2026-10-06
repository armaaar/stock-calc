import {
  IsBoolean, IsNumber, Min, ValidateIf,
} from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PortfolioRequest, PortfolioUseCase } from './PortfolioUseCase.abstract'

export interface InvestmentRequest extends PortfolioRequest {
  /** Added to the portfolio value; negative to withdraw. */
  investment: number
  /** Only buy, never sell: the investment can't be negative. Default false. */
  buyOnly?: boolean
}

/** A validated investment: any finite amount, or one of at least 0 when only buying. */
export class Investment {
  @IsNumber()
  public readonly amount: number

  @IsBoolean()
  public readonly buyOnly: boolean

  // Buying only can't raise money for a withdrawal
  @ValidateIf((investment: Investment) => investment.buyOnly)
  @Min(0)
  protected get buyOnlyAmount(): number {
    return this.amount
  }

  constructor(amount: number, buyOnly = false) {
    this.amount = amount
    this.buyOnly = buyOnly

    validateClassErrors(this, Investment)
  }
}

export class GetPortfolioWithInvestmentUseCase extends PortfolioUseCase<InvestmentRequest> {
  public async execute({ portfolioType, investment, buyOnly }: InvestmentRequest) {
    const request = new Investment(investment, buyOnly)
    const amount = new Decimal(request.amount)
    const portfolio = await this.portfolioRepo.getPortfolio(portfolioType)

    if (request.buyOnly) {
      portfolio.buyWithCash(amount)
    } else {
      portfolio.allocateCash(amount)
    }

    return portfolio
  }
}
