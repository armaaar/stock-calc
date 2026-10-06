import { IsNumber, IsPositive } from 'class-validator'
import Decimal from 'decimal.js'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PortfolioRequest, PortfolioUseCase } from './PortfolioUseCase.abstract'

export interface TargetPriceRequest extends PortfolioRequest {
  /** The portfolio value to plan for. */
  targetPrice: number
}

/** A validated target portfolio value: a finite number above 0. */
export class TargetPrice {
  @IsNumber()
  @IsPositive()
  public readonly amount: number

  constructor(amount: number) {
    this.amount = amount

    validateClassErrors(this, TargetPrice)
  }
}

export class GetPortfolioWithPriceUseCase extends PortfolioUseCase<TargetPriceRequest> {
  public async execute({ portfolioType, targetPrice }: TargetPriceRequest) {
    const amount = new Decimal(new TargetPrice(targetPrice).amount)
    const portfolio = await this.portfolioRepo.getPortfolio(portfolioType)

    portfolio.balanceForPrice(amount)

    return portfolio
  }
}
