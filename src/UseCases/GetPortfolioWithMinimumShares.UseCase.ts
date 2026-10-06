import {
  IsInt, IsNumber, IsPositive, Max, Min,
} from 'class-validator'
import Decimal from 'decimal.js'
import { PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'
import { roundToClosestMultiply } from '@/Shared/utils'
import { validateClassErrors } from '@/Shared/ClassValidatorError'
import { PortfolioUserCase } from './PortfolioUseCase.abstract'

export const DEFAULT_ACCEPTABLE_PRECESION = 0.01
export const DEFAULT_SHARES_STEP = 1
export const MAX_SEARCH_ITERATIONS = 100_000

export class GetPortfolioWithMinimumSharesUseCase extends PortfolioUserCase {
  @IsNumber()
  @IsPositive()
  @Max(1)
  private acceptablePrecision: number

  @IsInt()
  @Min(1)
  private sharesStep: number

  protected maxIterations = MAX_SEARCH_ITERATIONS

  constructor(portfolioType: string, acceptablePrecision?: number, sharesStep?: number) {
    super(portfolioType)
    this.acceptablePrecision = acceptablePrecision ?? DEFAULT_ACCEPTABLE_PRECESION
    this.sharesStep = sharesStep ?? DEFAULT_SHARES_STEP

    validateClassErrors(this, GetPortfolioWithMinimumSharesUseCase)
  }

  public async handler() {
    const portfolio = await this.getSourcePortfolio()

    // Drive the search from a security that must be held: scaling from a 0 target divides by 0
    const driver = portfolio.securities.find((sec) => sec.targetPercentage.greaterThan(0))
    if (!driver) throw Error('Portfolio has no security with a target percentage above 0')

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      driver.shares = iteration * this.sharesStep
      portfolio.securities.forEach((sec) => {
        if (sec === driver) return
        sec.shares = sec.targetPercentage.isZero()
          ? 0
          : roundToClosestMultiply(this.calcShares(driver, sec), this.sharesStep)
      })

      const totalPrice = portfolio.totalPrice
      if (portfolio.securities.every((sec) => this.areSharesPercise(sec, totalPrice))) {
        return portfolio
      }
    }

    throw Error(
      `No portfolio within precision ${this.acceptablePrecision} found in ${this.maxIterations} iterations`,
    )
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
