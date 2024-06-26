import { IsInt, Max, Min } from 'class-validator'
import Decimal from 'decimal.js'
import { PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'
import { roundToClosestMultiply } from '@/Shared/utils'
import { validateClassErrors } from '@/Shared/ClassValidatorError'
import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export const DEFAULT_ACCEPTABLE_PRECESION = 0.01
export const DEFAULT_SHARES_STEP = 1

export class GetPortfolioWithMinimumSharesUseCase extends PortfolioUserCase {
  @Min(0)
  @Max(1)
  private acceptablePrecision: number = DEFAULT_ACCEPTABLE_PRECESION

  @IsInt()
  @Min(1)
  private sharesStep: number = DEFAULT_SHARES_STEP

  constructor(portfolioType: string, acceptablePrecision?: number, sharesStep?: number) {
    super(portfolioType)
    if (acceptablePrecision) this.acceptablePrecision = acceptablePrecision
    if (sharesStep) this.sharesStep = sharesStep

    validateClassErrors(this, GetPortfolioWithMinimumSharesUseCase)
  }

  public async handler() {
    const portfolio = await this.getSourcePortfolio()

    let initialNumberOfTShares = this.sharesStep

    while (!portfolio.securities.every(
      (sec) => this.areSharesPercise(sec, portfolio.totalPrice),
    )) {
      const assumedSec = portfolio.securities[0]
      assumedSec.shares = initialNumberOfTShares
      initialNumberOfTShares += this.sharesStep
      for (let index = 1; index < portfolio.securities.length; index++) {
        const sec = portfolio.securities[index]
        sec.shares = roundToClosestMultiply(this.calcShares(assumedSec, sec), this.sharesStep)
      }
    }

    return portfolio
  }

  private calcShares(knownTick: PortfolioSecurity, targetTick: PortfolioSecurity): number {
    return knownTick.price
      .times(knownTick.shares)
      .dividedBy(knownTick.targetPercentage)
      .times(targetTick.targetPercentage)
      .dividedBy(targetTick.price)
      .round()
      .toNumber()
  }

  private areSharesPercise(sec: PortfolioSecurity, totalPrice: Decimal): boolean {
    return sec.calcActualPercentage(totalPrice)
      .minus(sec.targetPercentage)
      .abs()
      .lessThanOrEqualTo(this.acceptablePrecision)
  }
}
